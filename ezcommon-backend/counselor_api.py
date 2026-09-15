"""
Counselor API for Aipply

Four specialists share one student. Each has its own thread and its own job,
but they all read and write the same case file, so the essay coach knows which
schools the strategist steered toward and the coordinator knows what is already
drafted - the student never has to repeat themselves in a different tab.

Replies may also carry action links, so advice like "check your forecast" turns
into something the student can click instead of navigate to by hand.
"""
import json
import os
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from services.llm_providers import LLMProviderFactory

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
    print("✓ Counselor API: LLM provider initialized")
except Exception as e:
    print(f"⚠ Warning: Counselor API LLM provider initialization failed: {e}")
    llm_provider = None


def _extract_json(text: str) -> Optional[Any]:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            return None
    return None


AGENTS: Dict[str, Dict[str, str]] = {
    "team": {
        "name": "Admissions Team",
        "role": (
            "You are the student's overall admissions guide. You answer general questions about the "
            "application process and route them to the right specialist when a question is really about "
            "school strategy, essays, or deadlines."
        ),
    },
    "strategist": {
        "name": "Admissions Strategist",
        "role": (
            "You are an admissions strategist. You focus on school fit, list balance across "
            "reach/target/safety, positioning, and what would most improve this student's odds. "
            "You do not draft essays - hand that to the essay coach."
        ),
    },
    "essay": {
        "name": "Essay Coach",
        "role": (
            "You are an essay coach. You focus on narrative, structure, specificity, and voice. You ask "
            "questions that pull real detail out of the student. You never write the essay for them - "
            "they must remain the author of their own application."
        ),
    },
    "coordinator": {
        "name": "Application Coordinator",
        "role": (
            "You are an application coordinator. You focus on deadlines, required materials, what is "
            "still unfinished, and the order to do things in. You are concrete and checklist-minded."
        ),
    },
}

# Where the counselors may send the student. Anything outside this map is dropped,
# so a hallucinated route can never render as a dead link.
ALLOWED_LINKS: Dict[str, str] = {
    "profile": "/profile",
    "colleges": "/colleges",
    "writing": "/writing",
    "forecast": "/forecast",
    "submit": "/submit",
}


class CounselorMessage(BaseModel):
    role: str
    content: str


class CounselorChatRequest(BaseModel):
    agent: str = "team"
    message: str
    history: List[CounselorMessage] = Field(default_factory=list)
    profile_context: str = ""
    colleges_summary: str = ""
    progress_summary: str = ""
    case_notes: List[str] = Field(default_factory=list)


class ActionLink(BaseModel):
    label: str
    href: str


class CounselorChatResponse(BaseModel):
    response: str
    note: Optional[str] = None
    links: List[ActionLink] = Field(default_factory=list)
    reasoning: List[str] = Field(default_factory=list)


@router.post("/api/counselor/chat", response_model=CounselorChatResponse, tags=["Counselor"])
async def counselor_chat(body: CounselorChatRequest):
    """Answer as one of the four specialists, with the shared case file in context."""
    if not llm_provider:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM provider not available",
        )

    agent = AGENTS.get(body.agent) or AGENTS["team"]
    other_agents = ", ".join(a["name"] for key, a in AGENTS.items() if key != body.agent)

    notes_block = (
        "\n".join(f"- {n}" for n in body.case_notes[-20:])
        if body.case_notes
        else "(nothing recorded yet)"
    )

    system_prompt = (
        f"You are {agent['name']}, one of four specialists working with the same student on their U.S. "
        f"college applications. {agent['role']}\n\n"
        f"The other specialists are: {other_agents}. You all share one case file - the notes below were "
        "written by whichever specialist learned them, so treat them as things the student has already "
        "told this team and never ask them to repeat that information.\n\n"
        f"SHARED CASE FILE:\n{notes_block}\n\n"
        "Answer in the student's language, concretely and without filler. Ground every claim in the "
        "student's actual profile and school list below - if something you need is missing, say plainly "
        "that it is missing rather than assuming it.\n\n"
        "Return JSON with:\n"
        "- reasoning: 2-4 short steps, max 8 words each, naming what you actually checked to answer "
        "this (e.g. 'Read their school list', 'Compared GPA to Duke's range'). Say what you looked at, "
        "not what you concluded - the student can read the conclusion in the reply itself.\n"
        "- response: your reply to the student\n"
        "- note: a single durable fact or decision from THIS exchange worth adding to the shared case "
        "file (e.g. an intended major, a school they ruled out, a constraint like cost or location). "
        "Max 20 words, written in the third person. Use null when nothing durable came up - most small "
        "talk should produce null, and never record something already in the case file.\n"
        f"- links: up to 2 pages to send the student to, each {{\"label\": \"...\", \"page\": \"...\"}} where "
        f"page is one of: {', '.join(ALLOWED_LINKS)}. Only include a page when your advice genuinely "
        "asks them to go do something there. Use [] otherwise.\n\n"
        'Respond ONLY with JSON: {"reasoning": ["..."], "response": "...", '
        '"note": "..." or null, "links": []}'
    )

    context_block = (
        f"STUDENT PROFILE:\n{body.profile_context or '(profile is empty)'}\n\n"
        f"SCHOOL LIST:\n{body.colleges_summary or '(no schools saved yet)'}\n\n"
        f"APPLICATION PROGRESS:\n{body.progress_summary or '(no progress recorded yet)'}"
    )

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages.append({"role": "user", "content": f"[Student Context]\n{context_block}"})
    messages.append({"role": "assistant", "content": "Understood - I have their profile, list, and progress."})
    for m in body.history[-8:]:
        if m.role in {"user", "assistant"}:
            messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": body.message})

    try:
        raw = llm_provider.chat_completion(messages=messages, temperature=0.5, max_tokens=1200)
        parsed = _extract_json(raw["content"])

        if not isinstance(parsed, dict) or not parsed.get("response"):
            # A specialist that answers in prose is still useful - keep the reply,
            # just without a note or links this turn.
            return CounselorChatResponse(response=raw["content"].strip(), note=None, links=[], reasoning=[])

        note = parsed.get("note")
        note_text = str(note).strip() if note else ""
        if note_text.lower() in {"null", "none", ""}:
            note_text = ""

        links: List[ActionLink] = []
        for item in parsed.get("links", [])[:2]:
            if not isinstance(item, dict):
                continue
            href = ALLOWED_LINKS.get(str(item.get("page", "")).strip().lower())
            label = str(item.get("label", "")).strip()
            if href and label:
                links.append(ActionLink(label=label, href=href))

        reasoning = [
            str(step).strip()
            for step in parsed.get("reasoning", [])[:4]
            if isinstance(step, (str, int, float)) and str(step).strip()
        ]

        return CounselorChatResponse(
            response=str(parsed["response"]).strip(),
            note=note_text or None,
            links=links,
            reasoning=reasoning,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


class StudentProfileRequest(BaseModel):
    profile_context: str = ""
    gpa: Optional[float] = None
    class_rank: str = ""
    sat: Optional[int] = None
    act: Optional[int] = None
    intended_major: str = ""
    activities_context: str = ""
    honors_context: str = ""
    locale: str = "en"


class StudentProfileSummary(BaseModel):
    """A counsellor's read on the student, in the shape a reader can scan."""

    verdict: str = ""                       # one sentence, the whole student
    academic: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    activities: List[str] = Field(default_factory=list)
    growth: List[str] = Field(default_factory=list)
    has_data: bool = False


@router.post("/api/counselor/student-profile", response_model=StudentProfileSummary, tags=["Counselor"])
async def student_profile(body: StudentProfileRequest):
    """Summarise the student the way a counsellor would describe them.

    The profile page already shows every field the student typed. This is the
    other thing a counsellor has and a form does not: a read on what those
    fields add up to, and - the part students never get - what is conspicuously
    missing for the schools they are aiming at.

    Growth areas are the point. Anyone can list a GPA back at you; naming the
    gap between a stated major and the evidence for it is the work.
    """
    if not llm_provider:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LLM provider not available")

    facts = [
        f"GPA: {body.gpa:.2f}/4.0" if body.gpa else "",
        f"Class rank: {body.class_rank}" if body.class_rank else "",
        f"SAT: {body.sat}" if body.sat else "",
        f"ACT: {body.act}" if body.act else "",
        f"Intended major: {body.intended_major}" if body.intended_major else "",
    ]
    known = "\n".join(f for f in facts if f)
    body_text = "\n\n".join(
        part for part in [
            f"Known academics:\n{known}" if known else "",
            f"Activities:\n{body.activities_context}" if body.activities_context else "",
            f"Honors and awards:\n{body.honors_context}" if body.honors_context else "",
            f"Full profile:\n{body.profile_context}" if body.profile_context else "",
        ] if part
    )

    if not body_text.strip():
        return StudentProfileSummary(has_data=False)

    language = "Simplified Chinese" if body.locale == "zh" else "English"
    system_prompt = (
        "You are an experienced admissions counsellor writing a short internal read on one student, "
        "for that student to see. Work only from what you are given - never invent a score, an award "
        "or an activity, and never pad a thin profile to look fuller than it is.\n\n"
        f"Write in {language}.\n\n"
        "Return JSON:\n"
        "- verdict: ONE sentence describing this student as a whole, the way you would open a "
        "recommendation. Concrete, not flattering. If the profile is thin, say that plainly.\n"
        "- academic: 2-4 short lines, each a single fact as printed - a GPA, a rank, a score. Omit "
        "anything you were not given rather than writing 'not provided'.\n"
        "- strengths: 2-4 short phrases naming what this student is demonstrably good at, each "
        "grounded in something in the profile.\n"
        "- activities: 2-4 short lines on what they actually do outside class, naming the activity.\n"
        "- growth: 2-4 short lines on what is MISSING for where they are headed - the evidence an "
        "admissions officer would expect to see for their stated major and does not. This is the most "
        "useful section; be specific and direct rather than encouraging. If their intended major is "
        "known, judge the gaps against that major.\n\n"
        'Respond ONLY with JSON: {"verdict": "...", "academic": [], "strengths": [], '
        '"activities": [], "growth": []}'
    )

    try:
        raw = llm_provider.chat_completion(
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": body_text[:9000]}],
            temperature=0.3,
            max_tokens=900,
        )
        parsed = _extract_json(raw["content"])
        if not isinstance(parsed, dict):
            raise ValueError("unusable response")

        def lines(key: str) -> List[str]:
            value = parsed.get(key)
            if not isinstance(value, list):
                return []
            return [str(x).strip() for x in value if str(x).strip()][:4]

        return StudentProfileSummary(
            verdict=str(parsed.get("verdict", "")).strip(),
            academic=lines("academic"),
            strengths=lines("strengths"),
            activities=lines("activities"),
            growth=lines("growth"),
            has_data=True,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not build the profile: {e}")
