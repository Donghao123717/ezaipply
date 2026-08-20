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

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

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
    print("✓ Visa API: LLM provider initialized")
except Exception as e:
    print(f"⚠ Warning: Visa API LLM provider initialization failed: {e}")
    llm_provider = None


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


class VisaChatRequest(BaseModel):
    message: str
    ds160_context: str = ""
    profile_context: str = ""
    history: List[VisaChatMessage] = []


class VisaChatResponse(BaseModel):
    response: str


@router.post("/api/visa/chat", response_model=VisaChatResponse, tags=["Visa"])
async def visa_chat(body: VisaChatRequest):
    """Conversational visa assistant grounded in the applicant's profile and DS-160 answers so far."""
    if not llm_provider:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LLM provider not available")

    system_prompt = (
        "You are Visa Advisor, an experienced F-1/B1-B2 U.S. visa consultant assistant embedded in a "
        "college-application platform. This is the applicant - you can see their profile and their "
        "DS-160 answers so far. Use this to: point out what's missing or looks weak before they can "
        "realistically submit, analyze their likelihood of visa approval/denial and why, help them "
        "prepare for the consular interview (what questions to expect and how to answer clearly and "
        "consistently with what they've written), and flag anything inconsistent between their profile "
        "and their DS-160 answers. This is directional, illustrative guidance for a demo product, not "
        "a certified legal opinion or a guarantee of any outcome - remind the student to confirm "
        "anything consequential with their school's international student office or an immigration "
        "attorney. Keep replies focused and concrete."
    )
    context = (
        f"Applicant's Profile:\n{body.profile_context or '(no profile info provided yet)'}\n\n"
        f"Applicant's DS-160 answers so far:\n{body.ds160_context or '(no DS-160 answers filled in yet)'}"
    )

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages.append({"role": "user", "content": f"[Applicant Context]\n{context}"})
    messages.append({"role": "assistant", "content": "Got it, I can see this applicant's profile and DS-160 answers."})
    for m in body.history[-8:]:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": body.message})

    try:
        response = llm_provider.chat_completion(messages=messages, temperature=0.5, max_tokens=800)
        return VisaChatResponse(response=response["content"].strip())
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
