"""
Essay Writing API for Aipply
Drafts, coaches, and evaluates college application essays using an LLM provider.
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
    """Same shape/defaults as auth_api.py's _build_llm_config, kept independent
    per this repo's convention of self-contained feature routers (see voice_api.py)."""
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
    print("✓ Essay API: LLM provider initialized")
except Exception as e:
    print(f"⚠ Warning: Essay API LLM provider initialization failed: {e}")
    llm_provider = None


def _require_llm():
    if not llm_provider:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM provider not available",
        )


def _extract_json(text: str) -> Optional[Any]:
    """Defensively pull a JSON object/array out of an LLM response."""
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


class DraftRequest(BaseModel):
    prompt: str
    profile_context: str = ""
    word_limit: int = 650
    essay_type: str = "Personal essay"


class DraftResponse(BaseModel):
    draft: str


@router.post("/api/essay/draft", response_model=DraftResponse, tags=["Essay"])
async def draft_essay(body: DraftRequest):
    """Generate a first-draft essay from the student's profile and a prompt."""
    _require_llm()

    system_prompt = (
        "You are an experienced U.S. college application essay coach. Write a first-draft "
        "personal essay in the student's voice: honest, specific, and grounded in the details "
        "provided. Avoid cliches, generic statements, and repeating the prompt verbatim. "
        f"Target length: about {body.word_limit} words. Return ONLY the essay text, no title, "
        "no preamble, no markdown."
    )
    user_prompt = (
        f"Essay type: {body.essay_type}\n"
        f"Prompt: {body.prompt or '(no specific prompt selected - write a strong personal statement)'}\n\n"
        f"Student profile details to draw from:\n{body.profile_context or '(no profile details provided yet)'}"
    )

    try:
        response = llm_provider.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.8,
            max_tokens=1400,
        )
        return DraftResponse(draft=response["content"].strip())
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


class CoachMessage(BaseModel):
    role: str
    content: str


class CoachRequest(BaseModel):
    message: str
    essay_content: str = ""
    prompt: str = ""
    history: List[CoachMessage] = []


class CoachResponse(BaseModel):
    response: str


@router.post("/api/essay/coach", response_model=CoachResponse, tags=["Essay"])
async def coach_essay(body: CoachRequest):
    """Conversational essay-writing assistant grounded in the student's current draft."""
    _require_llm()

    system_prompt = (
        "You are Essay Coach, a warm but direct college essay writing assistant embedded in "
        "an essay editor. You can see the student's current draft and the prompt they're "
        "answering. Give concrete, actionable suggestions (specific lines to change, questions "
        "to sharpen a vague passage, structural notes). Keep replies focused and under 200 words "
        "unless the student explicitly asks for a rewrite or expansion."
    )
    context = (
        f"Essay prompt: {body.prompt or '(none selected)'}\n\n"
        f"Current draft:\n{body.essay_content or '(empty - nothing written yet)'}"
    )

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages.append({"role": "user", "content": f"[Context]\n{context}"})
    messages.append({"role": "assistant", "content": "Got it, I can see the prompt and current draft."})
    for m in body.history[-8:]:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": body.message})

    try:
        response = llm_provider.chat_completion(messages=messages, temperature=0.6, max_tokens=600)
        return CoachResponse(response=response["content"].strip())
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


class EvaluateRequest(BaseModel):
    essay_content: str
    prompt: str = ""
    word_limit: int = 650
    deep_review: bool = False


class EvaluationFeedbackItem(BaseModel):
    category: str
    comment: str


class EvaluateResponse(BaseModel):
    overall_score: int
    summary: str
    feedback: List[EvaluationFeedbackItem]
    word_count: int


@router.post("/api/essay/evaluate", response_model=EvaluateResponse, tags=["Essay"])
async def evaluate_essay(body: EvaluateRequest):
    """Score and critique an essay draft."""
    _require_llm()

    text = re.sub(r"<[^>]+>", " ", body.essay_content or "")
    word_count = len([w for w in text.split() if w.strip()])

    if not text.strip():
        return EvaluateResponse(
            overall_score=0,
            summary="There's nothing written yet - start a draft first.",
            feedback=[],
            word_count=0,
        )

    depth = "Give a thorough, line-level review covering voice, structure, specificity, and pacing." \
        if body.deep_review else "Give a concise single-pass review covering the most impactful issues only."

    system_prompt = (
        "You are an admissions essay reviewer. Evaluate the draft against the prompt and the "
        f"{body.word_limit}-word target. {depth} "
        "Respond ONLY with JSON matching this shape: "
        '{"overall_score": <0-100 integer>, "summary": "<2-3 sentence overview>", '
        '"feedback": [{"category": "<short label like \'Opening hook\' or \'Specificity\'>", "comment": "<1-2 sentences>"}]}. '
        "Include 3 to 6 feedback items."
    )
    user_prompt = f"Prompt: {body.prompt or '(none selected)'}\n\nEssay ({word_count} words):\n{text}"

    try:
        response = llm_provider.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=900,
        )
        parsed = _extract_json(response["content"])
        if not isinstance(parsed, dict):
            raise ValueError("Could not parse evaluation response")

        feedback_items = [
            EvaluationFeedbackItem(category=str(f.get("category", "Note")), comment=str(f.get("comment", "")))
            for f in parsed.get("feedback", [])
            if isinstance(f, dict)
        ]

        return EvaluateResponse(
            overall_score=int(parsed.get("overall_score", 0)),
            summary=str(parsed.get("summary", "")),
            feedback=feedback_items,
            word_count=word_count,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
