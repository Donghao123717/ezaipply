"""
Visa Risk Review API for Aipply
Reviews a completed DS-160 section's answers for patterns that commonly
cause visa applications to get flagged or denied - inconsistent dates,
thin/missing evidence of ties to the home country, vague funding/itinerary
answers, unexplained gaps on "Yes" answers in the security section. This is
a directional, illustrative review for a demo product, not a certified legal
opinion - same framing as forecast_api.py's admission-chance estimate.
"""
import json
import os
import random
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from services.llm_providers import LLMProviderFactory
from services.voice_service import VoiceService

router = APIRouter()


def _build_llm_config() -> Dict[str, Any]:
    return {
        'LLM_PROVIDER': os.environ.get('LLM_PROVIDER', 'openai'),
        'OPENAI_API_KEY': os.environ.get('OPENAI_API_KEY'),
        'OPENAI_MODEL': os.environ.get('OPENAI_MODEL', 'gpt-4o-mini'),
        'OPENAI_VISION_MODEL': os.environ.get('OPENAI_VISION_MODEL', 'gpt-4o'),
        'GEMINI_API_KEY': os.environ.get('GEMINI_API_KEY'),
        'GEMINI_MODEL': os.environ.get('GEMINI_MODEL', 'gemini-2.0-flash'),
        'AWS_REGION': os.environ.get('AWS_REGION', 'us-east-1'),
        'BEDROCK_MODEL': os.environ.get('BEDROCK_MODEL', 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
    }


llm_provider = None
try:
    llm_provider = LLMProviderFactory.create(_build_llm_config())
    print("✓ Visa API: LLM provider initialized")
except Exception as e:
    print(f"⚠ Warning: Visa API LLM provider initialization failed: {e}")
    llm_provider = None

# VoiceService transcribes through an injected provider - constructing it without
# one leaves every transcription raising "LLM provider not initialized".
voice_service = VoiceService(llm_provider=llm_provider) if llm_provider else None
if voice_service:
    print("✓ Visa API: voice service initialized")


def _extract_json(text: str) -> Optional[Any]:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    match = re.search(r"[\[{].*[\]}]", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            return None
    return None


class RiskReviewRequest(BaseModel):
    user_id: str
    section: str
    answers: Dict[str, str] = {}
    profile_context: str = ""


class RiskFlag(BaseModel):
    field: str
    severity: str  # 'high' | 'medium' | 'low'
    message: str


class RiskReviewResponse(BaseModel):
    flags: List[RiskFlag]


@router.post("/api/visa/risk-review", response_model=RiskReviewResponse, tags=["Visa"])
async def review_ds160_risk(body: RiskReviewRequest):
    """Review one completed DS-160 section for common visa-denial risk patterns."""
    if not llm_provider:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LLM provider not available")

    if not body.answers:
        return RiskReviewResponse(flags=[])

    answers_json = json.dumps(body.answers, ensure_ascii=False)

    system_prompt = (
        "You are an experienced F-1 student visa consultant reviewing ONE section of a student's completed "
        "DS-160 nonimmigrant visa application for patterns that commonly cause consular officers to flag or "
        "deny an application. This is a DIRECTIONAL, illustrative review for a demo product, not a certified "
        "legal opinion or a guarantee of outcome.\n\n"
        "Look for: inconsistent or implausible dates; vague or unconvincing funding/itinerary answers; "
        "a 'Yes' answer on a security/background question with no explanation, or an explanation that is "
        "too vague to be useful; missing information in a field that a consular officer would expect to see "
        "filled in; anything that reads as evasive or contradictory.\n\n"
        "Do NOT flag a field just because it's empty if it's optional, and do NOT invent problems that aren't "
        "actually present - only real, specific concerns.\n\n"
        'Respond ONLY with JSON: {"flags": [{"field": "<answer key from the input>", "severity": "high|medium|low", '
        '"message": "<1-2 sentence, specific, actionable explanation>"}]}. Return {"flags": []} if nothing of '
        "concern is found - most sections should have zero or very few flags."
    )
    user_prompt = (
        f"DS-160 section: {body.section}\n\n"
        f"Answers (field key -> value):\n{answers_json}\n\n"
        f"Student profile context (for consistency checks):\n{body.profile_context or '(no profile context provided)'}"
    )

    try:
        response = llm_provider.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=1200,
        )
        parsed = _extract_json(response["content"])
        if not isinstance(parsed, dict) or not isinstance(parsed.get("flags"), list):
            return RiskReviewResponse(flags=[])

        valid_fields = set(body.answers.keys())
        flags = []
        for item in parsed["flags"]:
            if not isinstance(item, dict):
                continue
            field = str(item.get("field", ""))
            if field not in valid_fields:
                continue
            severity = str(item.get("severity", "low")).lower()
            if severity not in ("high", "medium", "low"):
                severity = "low"
            flags.append(RiskFlag(field=field, severity=severity, message=str(item.get("message", ""))))
        return RiskReviewResponse(flags=flags)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


class VisaChatMessage(BaseModel):
    role: str
    content: str


# "The applicant's language" is not inferable from an English transcript - asked
# to guess, the model once replied in Spanish. The UI knows the locale, so it
# passes it and every prompt states it outright.
LANGUAGE_NAMES = {"zh": "Simplified Chinese", "en": "English"}


def _language_rule(locale: str) -> str:
    name = LANGUAGE_NAMES.get((locale or "en").lower()[:2], "English")
    return f"Write everything you return to the applicant in {name}."


# Four specialists, the way the admissions side works. A visa applicant's
# questions really do split along these lines: what will they ask me, what do I
# bring, will I be refused, and what do I do next.
VISA_AGENTS: Dict[str, Dict[str, str]] = {
    "interviewer": {
        "name": "Mock Interviewer",
        "role": (
            "You are a U.S. consular officer conducting a visa interview. You are brisk and factual - "
            "real interviews run two to five minutes. You ask one question at a time and follow up on "
            "anything vague. You never coach mid-interview; you assess."
        ),
    },
    "documents": {
        "name": "Document Reviewer",
        "role": (
            "You review what the applicant is bringing to the interview - I-20, DS-160 confirmation, "
            "SEVIS receipt, financial evidence, academic records. You say precisely what is missing or "
            "weak, and what a consular officer would want to see instead."
        ),
    },
    "risk": {
        "name": "Risk Analyst",
        "role": (
            "You analyse refusal risk, above all INA 214(b) - the presumption of immigrant intent that "
            "the applicant must overcome. You reason about ties to the home country, funding, and how "
            "coherent the study or travel plan is. You are candid about weaknesses."
        ),
    },
    "coordinator": {
        "name": "Process Coordinator",
        "role": (
            "You handle sequence and logistics: what is done, what is next, what each step needs. You "
            "never book, schedule, or automate anything on the applicant's behalf - you tell them what "
            "to do and they do it themselves."
        ),
    },
}

# Where the visa specialists may send the applicant. Anything else is dropped,
# so a hallucinated route can never render as a dead link.
VISA_ALLOWED_LINKS: Dict[str, str] = {
    "ds160": "/visa/ds160",
    "prep": "/visa/prep",
    "counselor": "/visa/counselor",
    "profile": "/profile",
}

# F-1 and B1/B2 interviews barely overlap, so the type steers every prompt here.
# The areas a consular officer actually works through, per visa class.
#
# Without this the model was left to choose its own next question from an open
# prompt, and it chose the same three every time - study plan, funding, plans
# after graduation - because those are the most representative F-1 questions
# and nothing told it which ground had already been covered. An officer does
# not work that way: they open somewhere, and where they go next depends on
# what they have not yet tested.
#
# One topic is assigned per turn from a per-interview shuffle, so two runs of
# the same interview ask different things in a different order, and no run
# repeats itself.
VISA_TOPICS: Dict[str, List[Dict[str, str]]] = {
    "F1": [
        {"key": "school_choice", "ask": "Why did you choose this university over the others you were admitted to?", "probe": "Why this specific university over the others they were admitted to, and what they know about it - the programme, the city, a professor, the curriculum. Vagueness here is a classic red flag."},
        {"key": "study_plan", "ask": "What exactly will you be studying there?", "probe": "What exactly they will study, which courses or research area, and how it follows from what they studied before."},
        {"key": "funding", "ask": "Who is paying for your studies, and what do they do?", "probe": "Who is paying, what that person earns or has saved, and whether the amount credibly covers the cost the I-20 states."},
        {"key": "academic_background", "ask": "What were your grades and test scores?", "probe": "Their grades, test scores, and previous school - and whether the jump to this university is plausible."},
        {"key": "post_graduation", "ask": "What do you plan to do after you finish the degree?", "probe": "The concrete next step after the degree - a specific industry, employer type, or further study - and why it has to happen at home."},
        {"key": "ties_home", "ask": "Who depends on you at home?", "probe": "Family, property or obligations that exist right now - parents, siblings, a family business. Do NOT ask about post-graduation plans here; that is a separate question."},
        {"key": "why_not_home", "ask": "Why not study this subject in your own country?", "probe": "Why not study this subject at a university in their own country."},
        {"key": "relatives_us", "ask": "Do you have any relatives or close friends in the United States?", "probe": "Relatives or close contacts already in the United States, and their status."},
        {"key": "prior_travel", "ask": "Have you been to the United States before?", "probe": "Previous U.S. travel or visa refusals, and whether they left when they were supposed to."},
        {"key": "living_plan", "ask": "Where will you live, and do you plan to work while studying?", "probe": "Where they will live, how they will get around, and whether they intend to work."},
    ],
    # B1/B2 is refused far more often than F-1, and almost always under 214(b) -
    # the law presumes every applicant intends to immigrate until they show
    # otherwise. So these topics are weighted towards what actually sinks
    # applications: thin ties to home, vague plans, money that does not add up,
    # and answers that contradict the form.
    "B1B2": [
        {"key": "purpose", "ask": "What is the purpose of your trip?", "probe": "The specific reason for this trip. A vague answer - 'tourism', 'to visit' - is itself a refusal signal; press for what they will actually do."},
        {"key": "itinerary", "ask": "Where will you go, and how long will you stay?", "probe": "Exact dates, cities, and where they are staying. Not being able to say where they are going or when they are coming back is one of the most common refusal reasons."},
        {"key": "why_this_place", "ask": "Why did you choose that city?", "probe": "Why that particular city or state, and whether it fits the stated purpose. A trip with no reason for its destination reads as a cover story."},
        {"key": "funding", "ask": "Who is paying for this trip, and what do you earn?", "probe": "Who pays, their annual income, and whether the cost of the trip is plausible against it. Ask for the number."},
        {"key": "sponsor", "ask": "Who will you be staying with in the United States?", "probe": "The host: who they are, their immigration status, how the applicant knows them, and whether the applicant will be staying in their home. Do NOT ask who pays here - that is a separate question already covered elsewhere. A host who is an immediate relative with a green card cuts against the presumption of return."},
        {"key": "employment", "ask": "What do you do for work, and has your leave been approved?", "probe": "Their job, how long they have held it, and whether leave has actually been granted for the dates requested. Unemployed, or newly employed, is a common refusal profile."},
        {"key": "ties_family", "ask": "Who is staying behind when you travel?", "probe": "Spouse, children, elderly parents who depend on them. Being young, single and without dependents is the profile refused fastest, and they should know to lead with whatever ties they do have."},
        {"key": "ties_assets", "ask": "Do you own property or a business at home?", "probe": "Property, a business, savings, or anything else that would be costly to abandon."},
        {"key": "intent_to_return", "ask": "What brings you back?", "probe": "The direct 214(b) question. What specifically requires them to be home again - a job to return to, a lease, a term starting, a family obligation."},
        {"key": "no_work", "ask": "Do you intend to work while you are in the United States?", "probe": "Whether they understand a B visa permits no employment. Any hint of looking for work, or of an ambiguous 'business opportunity', is disqualifying."},
        {"key": "prior_travel", "ask": "Have you travelled outside your country before?", "probe": "Previous travel, previous U.S. trips, and whether they returned on time. A clean record of leaving on time is one of the strongest things they have; no travel history at all is a weakness."},
        {"key": "relatives_us", "ask": "Do you have relatives living in the United States?", "probe": "Relatives or close contacts in the U.S. and their status - especially immediate family who are citizens or permanent residents, which cuts directly against the presumption of return."},
        {"key": "previous_refusal", "ask": "Have you ever been refused a U.S. visa?", "probe": "Any previous refusal, and what has changed since. Concealing one is worse than having one."},
        {"key": "return_plan", "ask": "What happens the week after you get back?", "probe": "What is scheduled immediately after the trip. A concrete commitment on the calendar is worth more than a general promise to return."},
    ],
}


VISA_TYPES: Dict[str, Dict[str, str]] = {
    "F1": {
        "label": "F-1 student visa",
        "focus": (
            "Study plan and why this school and programme, how it fits what they studied before and "
            "what they intend to do after, who is paying and whether that funding is credible and "
            "documented, and what brings them home after graduation."
        ),
    },
    "B1B2": {
        "label": "B1/B2 visitor visa",
        "focus": (
            "The specific purpose and itinerary of this trip, who pays for it, employment or study "
            "they are returning to, prior travel and whether they left on time, and family, property "
            "or job ties that make return the obvious outcome."
        ),
    },
}


class ActionLink(BaseModel):
    label: str
    href: str


class VisaChatRequest(BaseModel):
    message: str
    agent: str = "interviewer"
    visa_type: str = "F1"
    ds160_context: str = ""
    profile_context: str = ""
    history: List[VisaChatMessage] = []
    case_notes: List[str] = Field(default_factory=list)
    locale: str = "en"


class VisaChatResponse(BaseModel):
    response: str
    note: Optional[str] = None
    links: List[ActionLink] = Field(default_factory=list)
    reasoning: List[str] = Field(default_factory=list)


@router.post("/api/visa/chat", response_model=VisaChatResponse, tags=["Visa"])
async def visa_chat(body: VisaChatRequest):
    """Answer as one of the four visa specialists, grounded in the applicant's own DS-160."""
    if not llm_provider:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LLM provider not available")

    agent = VISA_AGENTS.get(body.agent) or VISA_AGENTS["interviewer"]
    visa = VISA_TYPES.get(body.visa_type) or VISA_TYPES["F1"]
    others = ", ".join(a["name"] for k, a in VISA_AGENTS.items() if k != body.agent)
    notes_block = "\n".join(f"- {n}" for n in body.case_notes[-20:]) or "(nothing recorded yet)"

    system_prompt = (
        f"You are {agent['name']}, one of four specialists helping one applicant with a "
        f"{visa['label']}. {agent['role']}\n\n"
        f"The other specialists are: {others}. You share one case file - the notes below were written "
        "by whichever specialist learned them, so never make the applicant repeat that information.\n\n"
        f"SHARED CASE FILE:\n{notes_block}\n\n"
        f"For this visa type, what actually decides the outcome is: {visa['focus']}\n\n"
        "You can see their profile and their DS-160 answers. Ground every claim in those - if "
        "something you need is missing, say so plainly rather than assuming it. Answer in the "
        "concretely, without filler.\n\n"
        "This is directional guidance for a demo product, not a legal opinion or any guarantee of an "
        "outcome. Never offer to book, schedule, or automate an appointment - that is the applicant's "
        "to do. Point them to their school's international student office or an immigration attorney "
        "for anything consequential.\n\n"
        "Return JSON with:\n"
        "- reasoning: 2-4 short steps, max 8 words each, naming what you checked (e.g. 'Read their "
        "funding answers', 'Compared travel dates to I-20'). What you looked at, not what you concluded.\n"
        "- response: your reply to the applicant\n"
        "- note: one durable fact from THIS exchange worth keeping (a refusal history, a funding "
        "source, a tie to home). Max 20 words, third person. null when nothing durable came up.\n"
        f"- links: up to 2 pages, each {{\"label\": \"...\", \"page\": \"...\"}} where page is one of: "
        f"{', '.join(VISA_ALLOWED_LINKS)}. Only when your advice asks them to go do something there.\n\n"
        + _language_rule(body.locale) + "\n\n"
        'Respond ONLY with JSON: {"reasoning": ["..."], "response": "...", "note": "..." or null, "links": []}'
    )

    context = (
        f"Applicant's profile:\n{body.profile_context or '(no profile info yet)'}\n\n"
        f"Applicant's DS-160 answers so far:\n{body.ds160_context or '(no DS-160 answers yet)'}"
    )

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages.append({"role": "user", "content": f"[Applicant Context]\n{context}"})
    messages.append({"role": "assistant", "content": "Understood - I have their profile and DS-160."})
    for m in body.history[-8:]:
        if m.role in {"user", "assistant"}:
            messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": body.message})

    try:
        raw = llm_provider.chat_completion(messages=messages, temperature=0.5, max_tokens=1200)
        parsed = _extract_json(raw["content"])
        if not isinstance(parsed, dict) or not parsed.get("response"):
            # A specialist that answers in prose is still useful - keep the reply.
            return VisaChatResponse(response=raw["content"].strip())

        note = str(parsed.get("note") or "").strip()
        if note.lower() in {"null", "none", ""}:
            note = ""

        links: List[ActionLink] = []
        for item in parsed.get("links", [])[:2]:
            if not isinstance(item, dict):
                continue
            href = VISA_ALLOWED_LINKS.get(str(item.get("page", "")).strip().lower())
            label = str(item.get("label", "")).strip()
            if href and label:
                links.append(ActionLink(label=label, href=href))

        reasoning = [
            str(step).strip()
            for step in parsed.get("reasoning", [])[:4]
            if isinstance(step, (str, int, float)) and str(step).strip()
        ]

        return VisaChatResponse(
            response=str(parsed["response"]).strip(),
            note=note or None,
            links=links,
            reasoning=reasoning,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


class InterviewTurn(BaseModel):
    question: str
    answer: str = ""


class InterviewRequest(BaseModel):
    visa_type: str = "F1"
    turns: List[InterviewTurn] = Field(default_factory=list)
    ds160_context: str = ""
    profile_context: str = ""
    # Fixed for the life of one interview, so the topic order is stable while
    # it runs and different the next time they start one.
    session_seed: int = 0
    locale: str = "en"


class ConsistencyFlag(BaseModel):
    severity: str
    said: str
    form_says: str
    detail: str


class InterviewResponse(BaseModel):
    question: str
    question_translation: str = ""
    evaluation: Optional[str] = None
    score: Optional[int] = None
    better_answer: Optional[str] = None
    consistency: List[ConsistencyFlag] = Field(default_factory=list)
    done: bool = False


# A real interview is a handful of questions, not a questionnaire. Past this the
# applicant has learned what they are going to learn from one sitting.
MAX_INTERVIEW_TURNS = 8


@router.post("/api/visa/interview", response_model=InterviewResponse, tags=["Visa"])
async def visa_interview(body: InterviewRequest):
    """
    One turn of a mock consular interview.

    The value here is not the questions - those are findable anywhere. It is that
    the applicant's spoken answer gets checked against what they actually wrote on
    their DS-160. Saying something that contradicts the form is a classic way to
    turn a routine interview into a refusal, and it is invisible to the applicant
    because they filled the form weeks earlier.
    """
    if not llm_provider:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LLM provider not available")

    visa = VISA_TYPES.get(body.visa_type) or VISA_TYPES["F1"]
    answered = [t for t in body.turns if t.answer.strip()]
    last = answered[-1] if answered else None
    done = len(answered) >= MAX_INTERVIEW_TURNS

    # The ground this question should cover. Shuffled per interview from the
    # seed the client holds, so the same applicant practising twice does not
    # get the same interview twice, and never the same question twice in one.
    topics = VISA_TOPICS.get(body.visa_type) or VISA_TOPICS["F1"]
    order = list(topics)
    random.Random(body.session_seed or 1).shuffle(order)
    topic = order[len(answered) % len(order)]

    transcript = "\n".join(f"Officer: {t.question}\nApplicant: {t.answer or '(no answer yet)'}" for t in body.turns)

    system_prompt = (
        f"You are a U.S. consular officer interviewing an applicant for a {visa['label']}, and also - "
        "between questions - the coach reviewing how they did.\n\n"
        f"What decides this visa type: {visa['focus']}\n\n"
        "Real interviews are two to five minutes and conducted in English. Ask ONE question at a time, "
        "short and direct, the way an officer actually speaks.\n\n"
        f"Ground this question should cover: {topic['probe']}\n"
        "Stay on that ground. You may abandon it to press a vague, rehearsed or evasive answer - an "
        "officer would - but only ONCE: if your previous question was already a follow-up, return to "
        "the assigned ground no matter how unsatisfying the last answer was. An officer presses once "
        "and moves on; they do not circle.\n\n"
        "Ask only questions a consular officer actually asks at the window. No hypotheticals about "
        "being refused, no questions about how the applicant feels, no coaching disguised as a "
        "question.\n\n"
        "Use their actual details. Their DS-160 below carries what their I-20 says - the school, the "
        "course of study, the SEVIS number - along with their funding, their family and their home "
        "city. Name those when you ask: 'why this university', 'why this programme', 'who is paying' "
        "land completely differently when the school and the parent's occupation are in the question. "
        "A generic question teaches nothing a list of sample questions would not. Where the form is "
        "genuinely silent, ask the plain version rather than inventing a detail.\n\n"
        + (
            "This is a B visa, so the law starts against the applicant: section 214(b) presumes every "
            "applicant intends to immigrate until they prove otherwise. Almost every refusal at this "
            "window is 214(b), and it is decided in under two minutes on thin ties, vague plans, or "
            "money that does not add up. Interview accordingly - press where a real officer would.\n\n"
            if body.visa_type == "B1B2"
            else ""
        )
        + "You can see the applicant's DS-160 answers. Your most important job is to catch where what "
        "they just SAID conflicts with what they WROTE on the form - a different funding source, a "
        "different length of stay, a different job, a relative in the U.S. they did not declare. Report "
        "these precisely, quoting both sides. Do not invent conflicts: if the spoken answer and the "
        "form agree, or the form is silent, return an empty list.\n\n"
        "\n"
        "Return JSON with:\n"
        "- question: the next question, in English, as an officer would ask it\n"
        "- question_translation: that question in Simplified Chinese, so the applicant understands "
        "what is being asked even though the real interview is in English\n"
        "- evaluation: your read on their LAST answer, in the applicant's own language - what landed "
        "and what a real officer would have doubted. null if they have not answered anything yet\n"
        "- score: 0-100 for that last answer, or null if there was none\n"
        "- better_answer: how to say that last answer in natural spoken English, one or two sentences, "
        "in THEIR facts, not invented ones. null if there was no last answer or it was already strong\n"
        + _language_rule(body.locale)
        + " The question and better_answer always stay in English - that is the language of the "
        "interview - but evaluation is for the applicant to read.\n"
        "- consistency: conflicts between the spoken answer and the DS-160, each "
        '{"severity": "high|medium|low", "said": "...", "form_says": "...", "detail": "..."}. '
        "Use [] when there are none.\n\n"
        + (
            # The example is conditional on purpose. Showing nulls to a model
            # that does have an answer to grade teaches it to return nulls, and
            # it did exactly that until this was split in two.
            'The applicant HAS just answered, so evaluation, score and better_answer are REQUIRED - '
            'never null. Respond ONLY with JSON: {"question": "...", "question_translation": "...", '
            '"evaluation": "Your answer was...", "score": 72, "better_answer": "I am going to...", '
            '"consistency": []}'
            if last
            else 'This is the opening question, so there is nothing to grade yet. Respond ONLY with JSON: '
            '{"question": "...", "question_translation": "...", "evaluation": null, "score": null, '
            '"better_answer": null, "consistency": []}'
        )
    )

    already_asked = [t.question for t in body.turns if t.question]
    asked_block = (
        "Questions you have ALREADY asked in this interview - asking any of these again, or a "
        "rephrasing of one, is a failure:\n"
        + "\n".join(f"  {i + 1}. {q}" for i, q in enumerate(already_asked))
        + "\n\n"
        if already_asked
        else ""
    )

    user_block = (
        f"Applicant's profile:\n{body.profile_context or '(none)'}\n\n"
        f"Applicant's DS-160 answers:\n{body.ds160_context or '(none)'}\n\n"
        f"Interview so far:\n{transcript or '(not started - ask your opening question)'}\n\n"
        + asked_block
        + (
            "The interview has run its length. Give your evaluation of the last answer and, for "
            "'question', a one-line closing remark instead of another question."
            if done
            else "Ask the next question."
        )
    )

    try:
        raw = llm_provider.chat_completion(
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_block}],
            temperature=0.6,
            max_tokens=1800,
        )
        parsed = _extract_json(raw["content"])
        if not isinstance(parsed, dict) or not parsed.get("question"):
            # One retry, then carry on with the plain question for this topic.
            # Losing the coaching on one turn is a degraded interview; a 502
            # mid-session is a lost one, and the applicant did nothing wrong.
            raw = llm_provider.chat_completion(
                messages=[{"role": "system", "content": system_prompt},
                          {"role": "user", "content": user_block}],
                temperature=0.7,
                max_tokens=1800,
            )
            parsed = _extract_json(raw["content"])
        if not isinstance(parsed, dict) or not parsed.get("question"):
            parsed = {"question": topic.get("ask", "Tell me about your plans."),
                      "question_translation": "", "evaluation": None,
                      "score": None, "better_answer": None, "consistency": []}

        flags: List[ConsistencyFlag] = []
        for item in parsed.get("consistency", [])[:6]:
            if not isinstance(item, dict):
                continue
            severity = str(item.get("severity", "medium")).strip().lower()
            if severity not in {"high", "medium", "low"}:
                severity = "medium"
            said = str(item.get("said", "")).strip()
            form_says = str(item.get("form_says", "")).strip()
            if not said or not form_says:
                continue
            flags.append(
                ConsistencyFlag(
                    severity=severity,
                    said=said,
                    form_says=form_says,
                    detail=str(item.get("detail", "")).strip(),
                )
            )

        score = parsed.get("score")
        try:
            score = max(0, min(100, int(score))) if score is not None else None
        except (TypeError, ValueError):
            score = None

        def text_or_none(key: str) -> Optional[str]:
            value = str(parsed.get(key) or "").strip()
            return value if value and value.lower() not in {"null", "none"} else None

        return InterviewResponse(
            question=str(parsed["question"]).strip(),
            question_translation=str(parsed.get("question_translation") or "").strip(),
            evaluation=text_or_none("evaluation") if last else None,
            score=score if last else None,
            better_answer=text_or_none("better_answer") if last else None,
            consistency=flags,
            done=done,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


class RiskFactorRequest(BaseModel):
    visa_type: str = "F1"
    ds160_context: str = ""
    profile_context: str = ""
    locale: str = "en"


class RiskFactor(BaseModel):
    key: str
    label: str
    """0-100, higher is stronger. This is the applicant's standing on the factor,
    not a probability - a weak factor is a thing to go fix, not a verdict."""
    score: int
    finding: str
    evidence: List[str] = Field(default_factory=list)


class Risk214bResponse(BaseModel):
    factors: List[RiskFactor]
    overall: int
    summary: str
    missing: List[str] = Field(default_factory=list)


# The four things a consular officer is actually weighing under INA 214(b).
# Fixed rather than model-invented, so the same applicant gets the same axes
# every time and can watch one of them move as they fix it.
RISK_FACTORS_F1 = [
    ("homeTies", "Ties to home country"),
    ("funding", "Funding clarity"),
    ("academicCoherence", "Study plan coherence"),
    ("travelHistory", "Travel and refusal history"),
]
RISK_FACTORS_B1B2 = [
    ("homeTies", "Ties to home country"),
    ("funding", "Who pays for the trip"),
    ("tripPurpose", "Purpose and itinerary"),
    ("travelHistory", "Travel and refusal history"),
]


@router.post("/api/visa/risk-214b", response_model=Risk214bResponse, tags=["Visa"])
async def visa_risk_214b(body: RiskFactorRequest):
    """
    Break 214(b) refusal risk into the factors behind it.

    A single number tells an applicant nothing they can act on. The forecast
    module already learned this lesson for admissions chances; this is the same
    idea for visa risk - show which factor is weak so there is something to go
    and fix, and say plainly what is missing rather than scoring a blank.
    """
    if not llm_provider:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LLM provider not available")

    visa = VISA_TYPES.get(body.visa_type) or VISA_TYPES["F1"]
    factors = RISK_FACTORS_F1 if body.visa_type != "B1B2" else RISK_FACTORS_B1B2
    factor_lines = "\n".join(f'- {key}: {label}' for key, label in factors)

    system_prompt = (
        f"You assess U.S. visa refusal risk under INA 214(b) for a {visa['label']}. Every applicant is "
        "presumed to intend immigration until they show otherwise; your job is to say how well this "
        "applicant currently overcomes that presumption, factor by factor.\n\n"
        f"What matters for this visa type: {visa['focus']}\n\n"
        f"Score exactly these factors, using these keys:\n{factor_lines}\n\n"
        "Rules that matter:\n"
        "- Score 0-100 where higher is stronger. Base it only on what the applicant's profile and "
        "DS-160 actually say.\n"
        "- Where the evidence is simply absent, score it low AND name it in 'missing'. Do not invent a "
        "middling score to paper over a blank - an applicant needs to know the difference between 'this "
        "is weak' and 'you have not told us yet'.\n"
        "- evidence: quote or paraphrase the specific answers you scored from, max 3 per factor. Empty "
        "when you had nothing to go on.\n"
        "- finding: one sentence on why that score.\n"
        "- overall: your read across the factors, 0-100. Not an average - a single fatal weakness "
        "should drag it down.\n"
        "- summary: two or three sentences, leading with whichever factor "
        "most needs work.\n\n"
        "This is directional guidance for a demo product, not a legal opinion and not a prediction of "
        "any decision.\n\n"
        + _language_rule(body.locale) + "\n\n"
        'Respond ONLY with JSON: {"factors": [{"key": "...", "label": "...", "score": 0, '
        '"finding": "...", "evidence": ["..."]}], "overall": 0, "summary": "...", "missing": ["..."]}'
    )

    already_asked = [t.question for t in body.turns if t.question]
    asked_block = (
        "Questions you have ALREADY asked in this interview - asking any of these again, or a "
        "rephrasing of one, is a failure:\n"
        + "\n".join(f"  {i + 1}. {q}" for i, q in enumerate(already_asked))
        + "\n\n"
        if already_asked
        else ""
    )

    user_block = (
        f"Applicant's profile:\n{body.profile_context or '(none)'}\n\n"
        f"Applicant's DS-160 answers:\n{body.ds160_context or '(none)'}"
    )

    try:
        raw = llm_provider.chat_completion(
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_block}],
            temperature=0.3,
            max_tokens=1300,
        )
        parsed = _extract_json(raw["content"])
        if not isinstance(parsed, dict):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Risk analysis returned an unusable response",
            )

        by_key = {str(f.get("key", "")): f for f in parsed.get("factors", []) if isinstance(f, dict)}
        out: List[RiskFactor] = []
        for key, label in factors:
            item = by_key.get(key, {})
            try:
                score = max(0, min(100, int(item.get("score", 0))))
            except (TypeError, ValueError):
                score = 0
            evidence = [
                str(e).strip()
                for e in (item.get("evidence") or [])[:3]
                if isinstance(e, (str, int, float)) and str(e).strip()
            ]
            out.append(
                RiskFactor(
                    key=key,
                    label=str(item.get("label") or label),
                    score=score,
                    finding=str(item.get("finding", "")).strip(),
                    evidence=evidence,
                )
            )

        try:
            overall = max(0, min(100, int(parsed.get("overall", 0))))
        except (TypeError, ValueError):
            overall = 0

        missing = [
            str(m).strip()
            for m in (parsed.get("missing") or [])[:8]
            if isinstance(m, (str, int, float)) and str(m).strip()
        ]

        return Risk214bResponse(
            factors=out,
            overall=overall,
            summary=str(parsed.get("summary", "")).strip(),
            missing=missing,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


class VoiceFieldSpec(BaseModel):
    key: str
    label: str
    type: str = "text"
    options: List[str] = Field(default_factory=list)


class VoiceFillResponse(BaseModel):
    transcript: str
    values: Dict[str, str] = Field(default_factory=dict)
    unanswered: List[str] = Field(default_factory=list)


@router.post("/api/visa/voice-fill", response_model=VoiceFillResponse, tags=["Visa"])
async def visa_voice_fill(
    audio: UploadFile = File(..., description="Recorded answer"),
    fields_json: str = Form(..., description="JSON array of the fields being asked about"),
    section_label: str = Form("", description="Human name of the DS-160 page, for context"),
):
    """
    Turn a spoken answer into DS-160 field values.

    This exists for the handful of pages the profile cannot prefill - trip dates,
    where you are staying, who is receiving you, prior visits. They are short
    factual answers, and saying them out loud beats typing them into a dozen
    boxes.

    Deliberately not the existing /api/voice/transcribe: that one files a
    transcript into the applicant's documents as a side effect, which is right
    for an activity note and wrong for dictating a form field. Nothing here is
    written anywhere - the values come back for the applicant to review, and
    only what they accept reaches the form.
    """
    if not voice_service:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Voice service not available")
    if not llm_provider:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LLM provider not available")

    try:
        specs = json.loads(fields_json)
        if not isinstance(specs, list) or not specs:
            raise ValueError("fields_json must be a non-empty array")
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="fields_json is not a valid field list")

    try:
        audio_bytes = await audio.read()
        transcript = voice_service.transcribe_audio(audio_bytes, audio.filename or "answer.webm")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not transcribe: {e}")

    if not transcript.strip():
        return VoiceFillResponse(transcript="", values={}, unanswered=[s.get("key", "") for s in specs])

    field_lines = []
    for s in specs:
        line = f"- {s.get('key')}: {s.get('label')}"
        if s.get("options"):
            line += f" (must be exactly one of: {', '.join(s['options'])})"
        elif s.get("type") == "date":
            line += " (format YYYY-MM-DD)"
        field_lines.append(line)

    system_prompt = (
        "You turn a spoken answer into values for a DS-160 form page"
        + (f" ({section_label})" if section_label else "")
        + ".\n\n"
        "Rules:\n"
        "- Only fill a field the applicant actually addressed. Leave everything else out and list its "
        "key under 'unanswered'. Guessing here writes a wrong answer onto a sworn government form.\n"
        "- The applicant may speak Chinese. The DS-160 is filled in English, so translate values into "
        "English, but keep proper nouns as they would appear on their documents.\n"
        "- For a field with a fixed option list, return exactly one of those options or leave it out.\n"
        "- Dates as YYYY-MM-DD. If they said something relative like 'next August', resolve it only if "
        "the year is unambiguous; otherwise leave it out.\n\n"
        f"Fields on this page:\n" + "\n".join(field_lines) + "\n\n"
        'Respond ONLY with JSON: {"values": {"fieldKey": "value"}, "unanswered": ["fieldKey"]}'
    )

    try:
        raw = llm_provider.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"The applicant said:\n{transcript}"},
            ],
            temperature=0.1,
            max_tokens=800,
        )
        parsed = _extract_json(raw["content"]) or {}
        allowed = {str(s.get("key")): s for s in specs}
        values: Dict[str, str] = {}
        for key, value in (parsed.get("values") or {}).items():
            spec = allowed.get(str(key))
            if not spec or value is None or str(value).strip() == "":
                continue
            text = str(value).strip()
            options = spec.get("options") or []
            # A value outside the option list would not select anything in the UI.
            if options and text not in options:
                continue
            # A date whose year was never spoken has had its year invented. The
            # model was told not to, and did anyway - "August 20th" came back as
            # 2023-08-20. Guessing a year onto a sworn travel date is worse than
            # leaving the field for them to type.
            if spec.get("type") == "date":
                year = text[:4]
                if not (year.isdigit() and year in transcript):
                    continue
            values[str(key)] = text

        unanswered = [k for k in allowed if k not in values]
        return VoiceFillResponse(transcript=transcript, values=values, unanswered=unanswered)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


class TranscribeResponse(BaseModel):
    transcript: str


@router.post("/api/visa/transcribe-answer", response_model=TranscribeResponse, tags=["Visa"])
async def visa_transcribe_answer(audio: UploadFile = File(..., description="A spoken interview answer")):
    """
    Speech to text for one mock-interview answer.

    Plain transcription with no field mapping and no storage - the answer goes
    straight back to the interview, which grades it and checks it against the
    DS-160 like any typed one. Separate from /api/voice/transcribe because that
    files a transcript into the applicant's documents, and an interview answer
    is practice, not a document.
    """
    if not voice_service:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Voice service not available")
    try:
        audio_bytes = await audio.read()
        transcript = voice_service.transcribe_audio(audio_bytes, audio.filename or "answer.webm")
        return TranscribeResponse(transcript=transcript.strip())
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not transcribe: {e}")


class InterviewReviewRequest(BaseModel):
    visa_type: str = "F1"
    turns: List[InterviewTurn] = Field(default_factory=list)
    ds160_context: str = ""
    profile_context: str = ""
    locale: str = "en"


class InterviewReview(BaseModel):
    verdict: str
    overall_score: int
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    drill: List[str] = Field(default_factory=list)
    unresolved_conflicts: List[str] = Field(default_factory=list)


@router.post("/api/visa/interview-review", response_model=InterviewReview, tags=["Visa"])
async def visa_interview_review(body: InterviewReviewRequest):
    """
    Read the whole interview at once and say how it went.

    Per-answer feedback tells an applicant how each reply landed; it cannot tell
    them the thing that actually decides interviews - whether the account they
    gave hangs together across all of it. Someone can answer eight questions
    acceptably and still fund their studies three different ways by the end.
    """
    if not llm_provider:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LLM provider not available")

    answered = [t for t in body.turns if t.answer.strip()]
    if not answered:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No answers to review")

    visa = VISA_TYPES.get(body.visa_type) or VISA_TYPES["F1"]
    transcript = "\n\n".join(f"Officer: {t.question}\nApplicant: {t.answer}" for t in answered)

    system_prompt = (
        f"You have just watched a mock {visa['label']} interview and are debriefing the applicant.\n\n"
        f"What decides this visa type: {visa['focus']}\n\n"
        "Judge the interview as a whole, not answer by answer - they already have that. What matters "
        "here is whether one consistent story came through: the same funding source throughout, the "
        "same plan, the same dates, no answer quietly undoing an earlier one. Check the transcript "
        "against their DS-160 as well, and report any contradiction still standing at the end.\n\n"
        "Be direct. An applicant who is told a weak interview was fine walks into the real one unready.\n\n"
        "Any conflict with the DS-160 belongs in unresolved_conflicts, not weaknesses - it was put in "
        "the wrong field until this was spelled out, and it is the finding that matters most.\n\n"
        "Return JSON with:\n"
        "- verdict: two or three sentences leading with the single thing "
        "that would most change the outcome\n"
        "- overall_score: 0-100 for the interview as a whole. Not an average of the answers - one "
        "unexplained contradiction should cost more than three vague replies\n"
        "- strengths: up to 3 specific things that worked, quoting them\n"
        "- weaknesses: up to 4 specific problems, each naming what to do instead\n"
        "- drill: up to 3 questions they should practise again before the real interview\n"
        "- unresolved_conflicts: contradictions with the DS-160 or between their own answers that were "
        "never cleared up. [] when there are none - do not invent them.\n\n"
        + _language_rule(body.locale) + "\n\n"
        'Respond ONLY with JSON: {"verdict": "...", "overall_score": 0, "strengths": [], '
        '"weaknesses": [], "drill": [], "unresolved_conflicts": []}'
    )

    already_asked = [t.question for t in body.turns if t.question]
    asked_block = (
        "Questions you have ALREADY asked in this interview - asking any of these again, or a "
        "rephrasing of one, is a failure:\n"
        + "\n".join(f"  {i + 1}. {q}" for i, q in enumerate(already_asked))
        + "\n\n"
        if already_asked
        else ""
    )

    user_block = (
        f"Applicant's profile:\n{body.profile_context or '(none)'}\n\n"
        f"Applicant's DS-160 answers:\n{body.ds160_context or '(none)'}\n\n"
        f"Full interview transcript:\n{transcript}"
    )

    try:
        raw = llm_provider.chat_completion(
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_block}],
            temperature=0.35,
            max_tokens=1300,
        )
        parsed = _extract_json(raw["content"])
        if not isinstance(parsed, dict) or not parsed.get("verdict"):
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Review returned an unusable response")

        def strings(key: str, limit: int) -> List[str]:
            return [
                str(x).strip()
                for x in (parsed.get(key) or [])[:limit]
                if isinstance(x, (str, int, float)) and str(x).strip()
            ]

        try:
            score = max(0, min(100, int(parsed.get("overall_score", 0))))
        except (TypeError, ValueError):
            score = 0

        return InterviewReview(
            verdict=str(parsed["verdict"]).strip(),
            overall_score=score,
            strengths=strings("strengths", 3),
            weaknesses=strings("weaknesses", 4),
            drill=strings("drill", 3),
            unresolved_conflicts=strings("unresolved_conflicts", 5),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


class ParseI20Request(BaseModel):
    user_id: str
    filename: str


class ParsedI20(BaseModel):
    """The fields an I-20 carries that the DS-160 and the interview both want."""

    sevis_id: str = ""
    school_name: str = ""
    school_address: str = ""
    course_of_study: str = ""
    degree_level: str = ""
    program_start: str = ""
    program_end: str = ""
    estimated_annual_cost: str = ""
    funding_source: str = ""
    student_name: str = ""
    found: bool = False
    note: str = ""


@router.post("/api/visa/parse-i20", response_model=ParsedI20, tags=["Visa"])
async def parse_i20(body: ParseI20Request):
    """Read an uploaded I-20 and hand back the fields the rest of the app needs.

    Uploading the form and the app knowing what is on it are different things,
    and until now only the first happened - the mock interview kept asking
    generic questions because nothing had ever read the document. The I-20
    carries exactly what is missing: the school, the course, the SEVIS number,
    the cost the student has to show funding for.

    Text first, vision only if the PDF has no text layer. A scanned I-20 is
    common enough that falling back matters, but running vision on a normal
    text PDF would cost money for nothing.
    """
    if not llm_provider:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LLM provider not available")

    try:
        from services.intelligent_extractor_service import IntelligentExtractorService

        extractor = IntelligentExtractorService(llm_provider=llm_provider)
        file_bytes = extractor._fetch_file_bytes(body.user_id, body.filename, "visa")
        if not file_bytes:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Uploaded file could not be read")

        text = extractor._extract_text(body.filename, file_bytes) or ""
        if len(text.strip()) < 40 and body.filename.lower().endswith(".pdf"):
            # A scan: no text layer to read, so look at it instead.
            text = extractor._extract_text_from_image(body.filename, file_bytes, "png") or text

        if len(text.strip()) < 20:
            return ParsedI20(found=False, note="Could not read any text from that file")

        system_prompt = (
            "You are reading a U.S. Form I-20 (Certificate of Eligibility for F-1 status). Pull out "
            "only what is printed on it. Never guess or fill a field from general knowledge - if the "
            "document does not show it, return an empty string for it.\n\n"
            "Fields:\n"
            "- sevis_id: the SEVIS identifier, usually starting with N and digits\n"
            "- school_name: the school named on the form\n"
            "- school_address: the school's address as printed\n"
            "- course_of_study: the major or field of study\n"
            "- degree_level: e.g. Bachelor's, Master's, Doctorate\n"
            "- program_start / program_end: dates as printed\n"
            "- estimated_annual_cost: the total estimated expenses for one academic year, with currency\n"
            "- funding_source: how the student's funding is described, e.g. personal funds, family, "
            "school scholarship, with amounts if shown\n"
            "- student_name: the student's name as printed\n\n"
            'Respond ONLY with JSON: {"sevis_id": "", "school_name": "", "school_address": "", '
            '"course_of_study": "", "degree_level": "", "program_start": "", "program_end": "", '
            '"estimated_annual_cost": "", "funding_source": "", "student_name": ""}'
        )

        raw = llm_provider.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Document text:\n{text[:12000]}"},
            ],
            temperature=0.0,
            max_tokens=700,
        )
        parsed = _extract_json(raw["content"])
        if not isinstance(parsed, dict):
            return ParsedI20(found=False, note="Could not read the fields from that file")

        def take(key: str) -> str:
            value = parsed.get(key)
            return str(value).strip() if value not in (None, "") else ""

        result = ParsedI20(
            sevis_id=take("sevis_id"),
            school_name=take("school_name"),
            school_address=take("school_address"),
            course_of_study=take("course_of_study"),
            degree_level=take("degree_level"),
            program_start=take("program_start"),
            program_end=take("program_end"),
            estimated_annual_cost=take("estimated_annual_cost"),
            funding_source=take("funding_source"),
            student_name=take("student_name"),
        )
        # A file that yields nothing recognisable is more likely the wrong file
        # than an unusual I-20, and saying so beats silently filling nothing.
        result.found = bool(result.school_name or result.sevis_id or result.course_of_study)
        if not result.found:
            result.note = "That does not look like an I-20"
        return result

    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not read the I-20: {e}")
