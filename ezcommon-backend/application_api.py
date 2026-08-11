"""
Per-school Application Form API for Aipply
Suggests answers for a school's application form fields and powers the
"Application Form Helper" chat, using an LLM provider.
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
    print("✓ Application Form API: LLM provider initialized")
except Exception as e:
    print(f"⚠ Warning: Application Form API LLM provider initialization failed: {e}")
    llm_provider = None


def _require_llm():
    if not llm_provider:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM provider not available",
        )


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


class FieldSpec(BaseModel):
    key: str
    label: str
    type: str
    options: List[str] = []


class AutofillRequest(BaseModel):
    school: str
    fields: List[FieldSpec]
    profile_context: str = ""


class AutofillResponse(BaseModel):
    suggestions: Dict[str, str]


@router.post("/api/application-form/autofill", response_model=AutofillResponse, tags=["Application Form"])
async def autofill_form(body: AutofillRequest):
    """Suggest answers for a page of application-form fields from the student's profile."""
    _require_llm()

    if not body.fields:
        return AutofillResponse(suggestions={})

    field_lines = []
    for f in body.fields:
        opts = f" Options: {', '.join(f.options)}." if f.options else ""
        field_lines.append(f"- key: \"{f.key}\" | question: \"{f.label}\" | type: {f.type}.{opts}")

    system_prompt = (
        f"You are filling out {body.school}'s application form on behalf of a student, using only "
        "the profile details provided. For each field, propose the best-supported answer. For "
        "select/radio fields, you MUST return one of the listed options verbatim (or omit the key "
        "if none fit). For text fields, keep answers short and factual. If the profile has no "
        "relevant information for a field, omit that key entirely rather than guessing. "
        "Respond ONLY with a JSON object mapping field key to suggested answer, e.g. "
        '{"fieldKey": "answer"}.'
    )
    user_prompt = (
        f"Fields:\n{chr(10).join(field_lines)}\n\n"
        f"Student profile:\n{body.profile_context or '(no profile details provided yet)'}"
    )

    try:
        response = llm_provider.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=700,
        )
        parsed = _extract_json(response["content"])
        if not isinstance(parsed, dict):
            return AutofillResponse(suggestions={})
        valid_keys = {f.key for f in body.fields}
        suggestions = {k: str(v) for k, v in parsed.items() if k in valid_keys and v}
        return AutofillResponse(suggestions=suggestions)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


class FormHelperMessage(BaseModel):
    role: str
    content: str


class FormHelperRequest(BaseModel):
    school: str
    message: str
    history: List[FormHelperMessage] = []


class FormHelperResponse(BaseModel):
    response: str


@router.post("/api/application-form/chat", response_model=FormHelperResponse, tags=["Application Form"])
async def form_helper_chat(body: FormHelperRequest):
    """Conversational helper scoped to a specific school's application form."""
    _require_llm()

    system_prompt = (
        f"You are the Application Form Helper for {body.school}, embedded directly in the student's "
        "application form. Help them understand what a question is really asking, how to frame a "
        "strong answer, and what this school tends to value. Keep answers concise and specific to "
        f"{body.school} where you can. If you don't have school-specific knowledge for something, say "
        "so plainly rather than inventing details."
    )
    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for m in body.history[-8:]:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": body.message})

    try:
        response = llm_provider.chat_completion(messages=messages, temperature=0.6, max_tokens=500)
        return FormHelperResponse(response=response["content"].strip())
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
