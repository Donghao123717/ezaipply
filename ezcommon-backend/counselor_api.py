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
        "- response: your reply to the student\n"
        "- note: a single durable fact or decision from THIS exchange worth adding to the shared case "
        "file (e.g. an intended major, a school they ruled out, a constraint like cost or location). "
        "Max 20 words, written in the third person. Use null when nothing durable came up - most small "
        "talk should produce null, and never record something already in the case file.\n"
        f"- links: up to 2 pages to send the student to, each {{\"label\": \"...\", \"page\": \"...\"}} where "
        f"page is one of: {', '.join(ALLOWED_LINKS)}. Only include a page when your advice genuinely "
        "asks them to go do something there. Use [] otherwise.\n\n"
        'Respond ONLY with JSON: {"response": "...", "note": "..." or null, "links": []}'
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
            return CounselorChatResponse(response=raw["content"].strip(), note=None, links=[])

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

        return CounselorChatResponse(
            response=str(parsed["response"]).strip(),
            note=note_text or None,
            links=links,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
