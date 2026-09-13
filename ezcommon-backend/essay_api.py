"""
Essay Writing API for Aipply
Drafts, coaches, and evaluates college application essays using an LLM provider.
"""
import json
import os
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, status
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


# --- Essay reuse ------------------------------------------------------------
# One strong essay usually answers several schools' prompts with edits rather
# than a rewrite. These endpoints find those overlaps and perform the rewrite,
# so a student's College List starts from what they have already written.


class WrittenEssay(BaseModel):
    task_id: str
    title: str
    prompt: str = ""
    text: str
    word_count: int = 0


class TargetPrompt(BaseModel):
    task_id: str
    title: str
    school: str = ""
    prompt: str = ""
    word_limit: int = 650


class ReuseRequest(BaseModel):
    written: List[WrittenEssay] = []
    targets: List[TargetPrompt] = []


class ReuseMatch(BaseModel):
    source_task_id: str
    target_task_id: str
    score: int
    reason: str


class NextUp(BaseModel):
    task_id: str
    reason: str
    unlocks: int = 0


class ReuseResponse(BaseModel):
    matches: List[ReuseMatch]
    next_up: Optional[NextUp] = None


@router.post("/api/essay/reuse-matches", response_model=ReuseResponse, tags=["Essay"])
async def reuse_matches(body: ReuseRequest):
    """Score how far each finished essay carries toward each unwritten prompt."""
    _require_llm()

    if not body.written or not body.targets:
        return ReuseResponse(matches=[], next_up=None)

    written_block = "\n\n".join(
        f'[{e.task_id}] "{e.title}"\n'
        f'Prompt it answers: {e.prompt or "(no prompt recorded)"}\n'
        f"Essay ({e.word_count} words):\n{e.text[:2500]}"
        for e in body.written
    )
    target_block = "\n".join(
        f'[{t.task_id}] {t.school + " - " if t.school else ""}{t.title} '
        f'({t.word_limit} words max): {t.prompt or "(prompt text not published - treat as a general supplement)"}'
        for t in body.targets
    )

    system_prompt = (
        "You help a student reuse essays they have ALREADY written across the other prompts on their "
        "college list. You never write new content here - you only judge overlap.\n\n"
        "For every (written essay, unwritten prompt) pair that is genuinely reusable, return a match with:\n"
        "- score: integer 0-100, how much of the existing essay survives an adaptation. Be strict and "
        "realistic: 70+ means the core story and structure carry over with light edits; 40-69 means a "
        "substantial rewrite reusing the same material; below 40 is NOT worth reporting, so omit it.\n"
        "- reason: ONE sentence, max 20 words, naming the shared element (the story, theme, or evidence) "
        "and what would have to change.\n\n"
        "Omit pairs that are not genuinely reusable - returning nothing is correct when the prompts are "
        "unrelated. Never report a match above 85 unless the two prompts ask for essentially the same thing.\n\n"
        "Then pick ONE unwritten prompt as 'next_up': the one that, once written, would unlock the most "
        "reuse across the remaining prompts (prefer prompts shared by several schools, or broad personal "
        "topics that feed narrower ones). Give a 'reason' (max 20 words) and 'unlocks' = how many OTHER "
        "unwritten prompts it would likely help with.\n\n"
        'Respond ONLY with JSON: {"matches": [{"source_task_id": "...", "target_task_id": "...", '
        '"score": N, "reason": "..."}], "next_up": {"task_id": "...", "reason": "...", "unlocks": N}}'
    )
    user_prompt = (
        f"ESSAYS ALREADY WRITTEN:\n{written_block}\n\n"
        f"PROMPTS NOT YET WRITTEN:\n{target_block}"
    )

    try:
        response = llm_provider.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=1600,
        )
        parsed = _extract_json(response["content"])
        if not isinstance(parsed, dict):
            raise ValueError("Could not parse reuse response")

        source_ids = {e.task_id for e in body.written}
        target_ids = {t.task_id for t in body.targets}

        matches: List[ReuseMatch] = []
        for item in parsed.get("matches", []):
            if not isinstance(item, dict):
                continue
            source = str(item.get("source_task_id", ""))
            target = str(item.get("target_task_id", ""))
            if source not in source_ids or target not in target_ids:
                continue
            try:
                score = int(item.get("score", 0))
            except (TypeError, ValueError):
                continue
            if score < 40:
                continue
            matches.append(
                ReuseMatch(
                    source_task_id=source,
                    target_task_id=target,
                    score=max(0, min(100, score)),
                    reason=str(item.get("reason", "")).strip(),
                )
            )
        matches.sort(key=lambda m: m.score, reverse=True)

        next_up = None
        raw_next = parsed.get("next_up")
        if isinstance(raw_next, dict) and str(raw_next.get("task_id", "")) in target_ids:
            try:
                unlocks = int(raw_next.get("unlocks", 0))
            except (TypeError, ValueError):
                unlocks = 0
            next_up = NextUp(
                task_id=str(raw_next["task_id"]),
                reason=str(raw_next.get("reason", "")).strip(),
                unlocks=max(0, unlocks),
            )

        return ReuseResponse(matches=matches, next_up=next_up)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


class AdaptRequest(BaseModel):
    source_text: str
    source_prompt: str = ""
    target_prompt: str
    target_school: str = ""
    word_limit: int = 650


class AdaptResponse(BaseModel):
    draft: str
    changes: str


@router.post("/api/essay/adapt", response_model=AdaptResponse, tags=["Essay"])
async def adapt_essay(body: AdaptRequest):
    """Rewrite one of the student's own essays to answer a different prompt."""
    _require_llm()

    if not body.source_text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="source_text is required")

    system_prompt = (
        "You adapt a student's OWN existing college essay to answer a different prompt. This is the "
        "student's writing - preserve their voice, sentence rhythm, and the real experiences they "
        "describe. Do not invent new achievements, activities, or facts that are not in the source "
        "essay; if the new prompt asks for something the source does not cover, leave a clearly marked "
        "[bracketed note] telling the student what only they can add.\n\n"
        f"Stay within {body.word_limit} words.\n\n"
        "Return JSON with:\n"
        "- draft: the adapted essay as plain paragraphs separated by blank lines\n"
        "- changes: 1-2 sentences telling the student what you changed and what still needs their input\n\n"
        'Respond ONLY with JSON: {"draft": "...", "changes": "..."}'
    )
    user_prompt = (
        f"ORIGINAL PROMPT: {body.source_prompt or '(not recorded)'}\n\n"
        f"STUDENT'S ESSAY:\n{body.source_text[:4000]}\n\n"
        f"NEW PROMPT{' (' + body.target_school + ')' if body.target_school else ''}: {body.target_prompt}"
    )

    try:
        response = llm_provider.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.6,
            max_tokens=1600,
        )
        parsed = _extract_json(response["content"])
        if not isinstance(parsed, dict) or not parsed.get("draft"):
            raise ValueError("Could not parse adaptation response")
        return AdaptResponse(
            draft=str(parsed["draft"]).strip(),
            changes=str(parsed.get("changes", "")).strip(),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# --- Essay import -----------------------------------------------------------
# Students arrive with essays already written in Word or exported to PDF.
# Importing them turns that existing work into reuse sources instead of asking
# them to paste text into the editor by hand.

import io

MAX_IMPORT_BYTES = 5 * 1024 * 1024


class ImportResponse(BaseModel):
    text: str
    word_count: int
    filename: str


def _text_from_docx(data: bytes) -> str:
    from docx import Document

    document = Document(io.BytesIO(data))
    return "\n\n".join(p.text for p in document.paragraphs if p.text.strip())


def _text_from_pdf(data: bytes) -> str:
    from PyPDF2 import PdfReader

    reader = PdfReader(io.BytesIO(data))
    parts = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            continue
    return "\n".join(p for p in parts if p)


@router.post("/api/essay/import", response_model=ImportResponse, tags=["Essay"])
async def import_essay(file: UploadFile = File(...)):
    """Pull the plain text out of an essay the student already wrote."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The file is empty")
    if len(data) > MAX_IMPORT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Essay files are limited to 5 MB",
        )

    name = file.filename or "essay"
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""

    try:
        if ext == "docx":
            text = _text_from_docx(data)
        elif ext == "pdf":
            text = _text_from_pdf(data)
        elif ext in {"txt", "md"}:
            text = data.decode("utf-8", errors="ignore")
        elif ext == "doc":
            # Legacy binary .doc isn't a format we can read reliably.
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Please save this as .docx or PDF and import again",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Import supports .docx, .pdf, .txt and .md files",
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not read that file: {e}",
        )

    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No text found in that file - if it's a scanned PDF, paste the text instead",
        )

    return ImportResponse(text=text, word_count=len(text.split()), filename=name)
