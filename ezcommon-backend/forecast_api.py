"""
Admission Forecast API for Aipply
Estimates a rough admission-chance signal per saved school from the
student's profile, using an LLM provider. These are directional estimates
for demo purposes, not a statistical admissions model - see the "Low
forecast confidence" framing surfaced in the UI.

The chance is anchored to each school's real(ish) baseline acceptance rate
and how complete the student's profile/essays actually are (computed on the
frontend, see lib/profile-strength.ts), so an empty profile lands well below
baseline and a selective school stays selective regardless of profile
completeness - the LLM only nudges the anchor by a bounded amount based on
qualitative signals (GPA, activities, essay quality) in the profile text.
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
    print("✓ Forecast API: LLM provider initialized")
except Exception as e:
    print(f"⚠ Warning: Forecast API LLM provider initialization failed: {e}")
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


def _anchor_chance(baseline_rate: float, profile_strength: float) -> float:
    """
    Deterministic reference point the LLM is only allowed to nudge by a
    bounded amount. profile_strength is 0 (empty) to 1 (fully filled out).
    At strength=0 this is ~15% of the school's baseline rate (i.e. treat an
    applicant we know nothing about as meaningfully below-average, since
    people who do bother to fill out real application data tend to skew
    toward being reasonably prepared). At strength=1 it can go up to ~1.75x
    baseline, capturing a well-documented, strong applicant.
    """
    multiplier = 0.15 + 1.6 * max(0.0, min(1.0, profile_strength))
    return max(1.0, min(95.0, baseline_rate * multiplier))


class SchoolInput(BaseModel):
    id: str
    name: str
    category: str
    baseline_acceptance_rate: float = 30.0


class ForecastRequest(BaseModel):
    profile_context: str = ""
    essay_summary: str = ""
    profile_strength: float = 0.0
    schools: List[SchoolInput]


class SchoolForecast(BaseModel):
    id: str
    chance: int
    material_strength: int
    profile_fit: int
    narrative_fit: int
    analysis: str
    recommendation: str


class ForecastResponse(BaseModel):
    schools: List[SchoolForecast]


@router.post("/api/forecast/generate", response_model=ForecastResponse, tags=["Forecast"])
async def generate_forecast(body: ForecastRequest):
    """Generate a directional admission-chance estimate per saved school."""
    _require_llm()

    if not body.schools:
        return ForecastResponse(schools=[])

    anchors: Dict[str, float] = {s.id: _anchor_chance(s.baseline_acceptance_rate, body.profile_strength) for s in body.schools}

    school_lines = "\n".join(
        f"- id: \"{s.id}\" | name: \"{s.name}\" | student's category: {s.category} | "
        f"school's typical acceptance rate: ~{s.baseline_acceptance_rate:.0f}% | "
        f"reference estimate for THIS student at THIS school: {anchors[s.id]:.0f}%"
        for s in body.schools
    )

    profile_pct = round(body.profile_strength * 100)

    system_prompt = (
        "You are an experienced college admissions counselor giving a DIRECTIONAL, illustrative "
        "estimate for a demo product - not a certified statistical model.\n\n"
        f"The student's profile/essay completeness score is {profile_pct}/100 "
        f"({'essentially empty - we have almost no real information about this applicant' if profile_pct < 15 else 'partial' if profile_pct < 60 else 'substantially complete'}).\n\n"
        "For each school below, a REFERENCE ESTIMATE has already been computed from that school's real "
        "typical acceptance rate and the student's profile completeness - treat it as your starting point "
        "and primary anchor. You may adjust it by at most ±12 percentage points based on qualitative "
        "signals you actually see in the profile text (strong GPA/test scores, notable activities or "
        "awards, essay quality) - if the profile is empty or near-empty, do NOT adjust upward, since "
        "there is no evidence to justify it. Never output a chance far from the reference estimate, and "
        "never give two schools with very different reference estimates the same final number just "
        "because they're both in the student's list.\n\n"
        "For each school return:\n"
        "- chance: integer 0-100, your adjusted estimate (must stay within ±12 of the reference estimate given)\n"
        "- material_strength: integer 0-100, how strong the student's grades/scores look overall (0 if no data)\n"
        "- profile_fit: integer 0-100, how well the student's academic profile matches this school's typical admits (0 if no data)\n"
        "- narrative_fit: integer 0-100, how well their activities/essays-in-progress suggest a compelling application (0 if no essays/activities)\n"
        "- analysis: 2-4 sentences explaining the estimate, referencing specific profile details when available, or "
        "plainly noting the profile is empty/thin when it is\n"
        "- recommendation: 1-2 sentences of concrete, actionable advice for this school (e.g. what to fill in next "
        "if the profile is thin)\n\n"
        'Respond ONLY with JSON: {"schools": [{"id": "...", "chance": N, "material_strength": N, '
        '"profile_fit": N, "narrative_fit": N, "analysis": "...", "recommendation": "..."}]}'
    )
    user_prompt = (
        f"Schools (with reference estimates):\n{school_lines}\n\n"
        f"Student profile:\n{body.profile_context or '(no profile details provided yet)'}\n\n"
        f"Essay/writing progress so far:\n{body.essay_summary or '(no essays started yet)'}"
    )

    try:
        response = llm_provider.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=1600,
        )
        parsed = _extract_json(response["content"])
        if not isinstance(parsed, dict) or not isinstance(parsed.get("schools"), list):
            raise ValueError("Could not parse forecast response")

        valid_ids = {s.id for s in body.schools}
        results = []
        for item in parsed["schools"]:
            if not isinstance(item, dict) or item.get("id") not in valid_ids:
                continue
            school_id = str(item.get("id"))
            anchor = anchors[school_id]
            # Hard safety net: never let the model's number drift far from the
            # computed anchor, regardless of what it returned.
            raw_chance = int(item.get("chance", anchor))
            clamped_chance = max(1, min(95, max(anchor - 12, min(anchor + 12, raw_chance))))

            results.append(SchoolForecast(
                id=school_id,
                chance=round(clamped_chance),
                material_strength=max(0, min(100, int(item.get("material_strength", 0)))),
                profile_fit=max(0, min(100, int(item.get("profile_fit", 0)))),
                narrative_fit=max(0, min(100, int(item.get("narrative_fit", 0)))),
                analysis=str(item.get("analysis", "")),
                recommendation=str(item.get("recommendation", "")),
            ))
        return ForecastResponse(schools=results)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
