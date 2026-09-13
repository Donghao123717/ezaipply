"""
College Recommendation API for Aipply

Suggests schools the student hasn't saved yet, each with a short rationale and
a reach/target/safety bucket. Recommendations land in a staging area in the UI
- the student reviews them and chooses which ones join their real College List,
so nothing is added to their application list without an explicit decision.

Candidates come from the frontend's own college database, so every suggestion
maps to a school the student can actually add. The bucket is anchored to the
school's acceptance rate and the student's own scores rather than left to the
model, matching how forecast_api.py anchors its estimates.
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
    print("✓ Colleges API: LLM provider initialized")
except Exception as e:
    print(f"⚠ Warning: Colleges API LLM provider initialization failed: {e}")
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
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return None
    return None


CATEGORIES = {"reach", "target", "safety"}


class CandidateSchool(BaseModel):
    name: str
    acceptance_rate: float = 30.0


class RecommendRequest(BaseModel):
    profile_context: str = ""
    profile_strength: float = Field(0.0, ge=0.0, le=1.0)
    student_sat: Optional[int] = None
    student_act: Optional[int] = None
    student_gpa: Optional[float] = None
    saved_names: List[str] = Field(default_factory=list)
    candidates: List[CandidateSchool] = Field(default_factory=list)
    count: int = Field(8, ge=1, le=12)


class Recommendation(BaseModel):
    name: str
    category: str
    rationale: str
    acceptance_rate: float


class RecommendResponse(BaseModel):
    recommendations: List[Recommendation]


def _student_strength_score(
    profile_strength: float,
    sat: Optional[int],
    act: Optional[int],
    gpa: Optional[float],
) -> float:
    """0-1 signal for how competitive this applicant looks, from what we actually know.

    Scores dominate when present; profile completeness is the fallback so an
    empty profile never reads as a strong applicant.
    """
    signals: List[float] = []
    if sat:
        signals.append(max(0.0, min(1.0, (sat - 1000) / 600)))
    if act:
        signals.append(max(0.0, min(1.0, (act - 20) / 16)))
    if gpa:
        signals.append(max(0.0, min(1.0, (gpa - 2.5) / 1.5)))
    if not signals:
        return profile_strength * 0.5
    return sum(signals) / len(signals)


def _anchor_category(acceptance_rate: float, strength: float) -> str:
    """Bucket a school for this student: selective schools stay reaches for everyone,
    and a thin profile shifts everything toward reach."""
    effective = acceptance_rate * (0.6 + 0.8 * strength)
    if effective < 20:
        return "reach"
    if effective < 50:
        return "target"
    return "safety"


@router.post("/api/colleges/recommend", response_model=RecommendResponse, tags=["Colleges"])
async def recommend_colleges(body: RecommendRequest):
    """Suggest schools for the student to review, with a rationale for each."""
    _require_llm()

    saved = {n.strip().lower() for n in body.saved_names}
    pool = [c for c in body.candidates if c.name.strip().lower() not in saved]
    if not pool:
        return RecommendResponse(recommendations=[])

    strength = _student_strength_score(
        body.profile_strength, body.student_sat, body.student_act, body.student_gpa
    )
    anchors = {c.name: _anchor_category(c.acceptance_rate, strength) for c in pool}

    by_category: Dict[str, List[CandidateSchool]] = {"reach": [], "target": [], "safety": []}
    for c in pool:
        by_category[anchors[c.name]].append(c)

    def render(cands: List[CandidateSchool]) -> str:
        return ", ".join(f"{c.name} (~{c.acceptance_rate:.0f}% admit)" for c in cands) or "(none available)"

    profile_pct = round(body.profile_strength * 100)
    known_scores = ", ".join(
        part for part in [
            f"SAT {body.student_sat}" if body.student_sat else "",
            f"ACT {body.student_act}" if body.student_act else "",
            f"GPA {body.student_gpa:.2f}/4.0" if body.student_gpa else "",
        ] if part
    ) or "no test scores or GPA on file yet"

    system_prompt = (
        "You are an experienced college counselor building a balanced, realistic school list for a "
        "student to review. You may ONLY pick schools from the candidate lists given to you, and you "
        "must keep each school in the category it was listed under - those buckets were computed from "
        "each school's real acceptance rate and this student's actual scores.\n\n"
        f"Return exactly {body.count} schools: aim for a balanced mix of roughly 1/3 reach, 1/3 target, "
        "and 1/3 safety, adjusting only if one of the candidate lists is too short.\n\n"
        "For each school write a 'rationale': ONE sentence, max 25 words, saying concretely why it suits "
        "THIS student. Reference something real from their profile (intended major, GPA, test scores, "
        "an activity) plus the school's selectivity. If the profile is empty, say plainly that this is "
        "a general starting point based on selectivity alone rather than inventing student details.\n\n"
        'Respond ONLY with JSON: {"recommendations": [{"name": "...", "category": "reach|target|safety", '
        '"rationale": "..."}]}'
    )

    user_prompt = (
        f"Student profile completeness: {profile_pct}/100\n"
        f"Known academics: {known_scores}\n\n"
        f"Reach candidates: {render(by_category['reach'][:40])}\n\n"
        f"Target candidates: {render(by_category['target'][:40])}\n\n"
        f"Safety candidates: {render(by_category['safety'][:40])}\n\n"
        f"Schools already on their list (do not repeat): "
        f"{', '.join(body.saved_names) if body.saved_names else '(none yet)'}\n\n"
        f"Student profile:\n{body.profile_context or '(no profile details provided yet)'}"
    )

    try:
        response = llm_provider.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=1200,
        )
        parsed = _extract_json(response["content"])
        if not isinstance(parsed, dict) or not isinstance(parsed.get("recommendations"), list):
            raise ValueError("Could not parse recommendation response")

        rates = {c.name: c.acceptance_rate for c in pool}
        seen: set = set()
        results: List[Recommendation] = []
        for item in parsed["recommendations"]:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name", "")).strip()
            # Drop anything invented, already saved, or repeated.
            if name not in rates or name.lower() in seen:
                continue
            seen.add(name.lower())
            category = str(item.get("category", "")).strip().lower()
            if category not in CATEGORIES:
                category = anchors[name]
            results.append(
                Recommendation(
                    name=name,
                    category=category,
                    rationale=str(item.get("rationale", "")).strip(),
                    acceptance_rate=rates[name],
                )
            )
            if len(results) >= body.count:
                break

        return RecommendResponse(recommendations=results)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recommendations: {e}",
        )
