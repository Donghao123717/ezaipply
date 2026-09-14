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
        "applicant's language, concretely, without filler.\n\n"
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

    transcript = "\n".join(f"Officer: {t.question}\nApplicant: {t.answer or '(no answer yet)'}" for t in body.turns)

    system_prompt = (
        f"You are a U.S. consular officer interviewing an applicant for a {visa['label']}, and also - "
        "between questions - the coach reviewing how they did.\n\n"
        f"What decides this visa type: {visa['focus']}\n\n"
        "Real interviews are two to five minutes and conducted in English. Ask ONE question at a time, "
        "short and direct, the way an officer actually speaks. Follow up when an answer is vague, "
        "rehearsed, or evasive rather than moving down a list.\n\n"
        "You can see the applicant's DS-160 answers. Your most important job is to catch where what "
        "they just SAID conflicts with what they WROTE on the form - a different funding source, a "
        "different length of stay, a different job, a relative in the U.S. they did not declare. Report "
        "these precisely, quoting both sides. Do not invent conflicts: if the spoken answer and the "
        "form agree, or the form is silent, return an empty list.\n\n"
        "Return JSON with:\n"
        "- question: the next question, in English, as an officer would ask it\n"
        "- question_translation: that question in Simplified Chinese, so the applicant understands "
        "what is being asked even though the real interview is in English\n"
        "- evaluation: your read on their LAST answer, in the applicant's own language - what landed "
        "and what a real officer would have doubted. null if they have not answered anything yet\n"
        "- score: 0-100 for that last answer, or null if there was none\n"
        "- better_answer: how to say that last answer in natural spoken English, one or two sentences, "
        "in THEIR facts, not invented ones. null if there was no last answer or it was already strong\n"
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

    user_block = (
        f"Applicant's profile:\n{body.profile_context or '(none)'}\n\n"
        f"Applicant's DS-160 answers:\n{body.ds160_context or '(none)'}\n\n"
        f"Interview so far:\n{transcript or '(not started - ask your opening question)'}\n\n"
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
            max_tokens=1100,
        )
        parsed = _extract_json(raw["content"])
        if not isinstance(parsed, dict) or not parsed.get("question"):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Interviewer returned an unusable response",
            )

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
        "- finding: one sentence on why that score, in the applicant's language.\n"
        "- overall: your read across the factors, 0-100. Not an average - a single fatal weakness "
        "should drag it down.\n"
        "- summary: two or three sentences, the applicant's language, leading with whichever factor "
        "most needs work.\n\n"
        "This is directional guidance for a demo product, not a legal opinion and not a prediction of "
        "any decision.\n\n"
        'Respond ONLY with JSON: {"factors": [{"key": "...", "label": "...", "score": 0, '
        '"finding": "...", "evidence": ["..."]}], "overall": 0, "summary": "...", "missing": ["..."]}'
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
