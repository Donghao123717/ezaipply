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
import logging
import os
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from services.llm_providers import LLMProviderFactory

logger = logging.getLogger(__name__)

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
    """One school the frontend is willing to have recommended, with everything
    known about it. The frontend owns the data files, so it sends the facts
    rather than the backend keeping a second copy that can drift."""

    name: str
    acceptance_rate: float = 30.0
    us_news_rank: Optional[int] = None
    # Typical admitted SAT, where a published range exists for this school.
    sat_mid: Optional[int] = None
    sat_range_known: bool = False
    # Fit attributes, from lib/school-fit-data.ts.
    region: str = ""
    setting: str = ""
    climate: str = ""
    coastal: bool = False
    undergrad: float = 0
    class_size_feel: str = ""
    cost_per_year: int = 0
    outcome: str = ""
    merit_aid: str = ""
    strong_programs: List[str] = Field(default_factory=list)
    has_ed: bool = False
    has_ea: bool = False


class StudentPreferences(BaseModel):
    """What the student told the counsellor they want. Every field is optional -
    an unanswered question must not penalise any school, so absent means the
    dimension simply does not score."""

    intended_major: str = ""
    # Ceiling in USD thousands per year, all-in.
    budget_per_year: Optional[int] = None
    needs_scholarship: Optional[bool] = None
    class_size: Optional[str] = None        # small | large
    after_graduation: Optional[str] = None  # work | masters | phd
    climate: Optional[str] = None           # warm | cold-ok
    regions: List[str] = Field(default_factory=list)
    coastal: Optional[str] = None           # coast | inland
    setting: Optional[str] = None           # big-city | college-town
    wants_ed_ea: Optional[bool] = None


class RecommendRequest(BaseModel):
    profile_context: str = ""
    profile_strength: float = Field(0.0, ge=0.0, le=1.0)
    student_sat: Optional[int] = None
    student_act: Optional[int] = None
    student_gpa: Optional[float] = None
    saved_names: List[str] = Field(default_factory=list)
    candidates: List[CandidateSchool] = Field(default_factory=list)
    preferences: StudentPreferences = Field(default_factory=StudentPreferences)
    count: int = Field(20, ge=1, le=30)


class FitReason(BaseModel):
    """Why this school scored the way it did, in dimensions a student can argue
    with. A ranked list with no visible reasoning is just an oracle."""

    label: str
    detail: str


class Recommendation(BaseModel):
    name: str
    category: str
    rationale: str
    acceptance_rate: float
    fit_score: int = 0
    reasons: List[FitReason] = Field(default_factory=list)
    # Flagged for the 1-2 schools worth spending an ED or EA card on.
    early_plan: Optional[str] = None


class RecommendResponse(BaseModel):
    recommendations: List[Recommendation]


def _student_strength_score(
    profile_strength: float,
    sat: Optional[int],
    act: Optional[int],
    gpa: Optional[float],
) -> float:
    """0-1 signal for how competitive this applicant looks, from what we know.

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


# Typical admitted SAT by overall acceptance rate, for the schools that do not
# publish a range we hold. Interpolated between these anchors. This is a proxy
# and is treated as one: a school with a real published range always uses it,
# and a school relying on this contributes less confidently to the score.
_SAT_BY_RATE = [(3, 1545), (5, 1530), (10, 1505), (15, 1478), (20, 1455),
                (30, 1405), (40, 1355), (50, 1310), (60, 1270), (70, 1230),
                (80, 1180), (90, 1120)]


def _expected_sat(cand: CandidateSchool) -> int:
    if cand.sat_mid:
        return cand.sat_mid
    rate = max(1.0, min(95.0, cand.acceptance_rate))
    for i in range(len(_SAT_BY_RATE) - 1):
        r0, s0 = _SAT_BY_RATE[i]
        r1, s1 = _SAT_BY_RATE[i + 1]
        if rate <= r1:
            span = r1 - r0
            t = 0.0 if span == 0 else (rate - r0) / span
            return round(s0 + (s1 - s0) * t)
    return _SAT_BY_RATE[-1][1]


def _student_sat_equivalent(sat: Optional[int], act: Optional[int]) -> Optional[int]:
    """One number to compare against a school's band. ACT is converted rather
    than averaged in, because a student who sat only the ACT should not be
    treated as though they had no SAT."""
    if sat:
        return sat
    if act:
        # Standard concordance, close enough across the range that matters.
        return int(round(min(1600, max(900, 40 * act + 260))))
    return None


def _categorise(cand: CandidateSchool, student_sat: Optional[int], strength: float) -> str:
    """reach / target / safety, from how the student's scores sit against this
    school's band and how selective it is overall.

    Selectivity alone was the old rule, and it made a 1550 and a 1250 applicant
    receive identical lists. Score position is what moves a school between
    buckets now; acceptance rate sets the floor, because a single-digit-admit
    school is a reach for everybody.
    """
    rate = cand.acceptance_rate
    if student_sat is None:
        # Nothing to compare: fall back to selectivity, shaded by how complete
        # the profile is, and lean conservative.
        effective = rate * (0.6 + 0.8 * strength)
        return "reach" if effective < 20 else ("target" if effective < 50 else "safety")

    gap = student_sat - _expected_sat(cand)
    # Roughly: each 60 points above a school's midpoint doubles your standing
    # relative to the published rate.
    odds = rate * (2.0 ** (gap / 60.0))
    if rate <= 8:
        odds = min(odds, 18.0)   # nobody's scores make an Ivy a target
    if odds < 15:
        return "reach"
    if odds < 45:
        return "target"
    return "safety"


def _program_match(cand: CandidateSchool, major: str) -> float:
    """0-1: does this school actually have a name in the field the student wants?"""
    if not major:
        return 0.5
    wanted = major.strip().lower()
    if not wanted:
        return 0.5
    for programme in cand.strong_programs:
        p = programme.lower()
        if p in wanted or wanted in p:
            return 1.0
    return 0.25


def _preference_score(cand: CandidateSchool, prefs: StudentPreferences) -> tuple[float, List[FitReason]]:
    """0-1 over whichever preferences the student actually expressed.

    Unanswered questions are skipped rather than scored as a mismatch: a
    student who did not say where they want to live should not have every
    school in the Midwest quietly demoted.
    """
    parts: List[float] = []
    reasons: List[FitReason] = []

    if prefs.budget_per_year:
        if cand.cost_per_year <= prefs.budget_per_year:
            parts.append(1.0)
            reasons.append(FitReason(label="预算", detail=f"约 ${cand.cost_per_year}k/年，在你的预算内"))
        else:
            over = cand.cost_per_year - prefs.budget_per_year
            parts.append(max(0.0, 1.0 - over / 40.0))
            reasons.append(FitReason(label="预算", detail=f"约 ${cand.cost_per_year}k/年，超出预算 ${over}k"))

    if prefs.needs_scholarship:
        value = {"meaningful": 1.0, "limited": 0.45, "none": 0.0}.get(cand.merit_aid, 0.4)
        parts.append(value)
        if cand.merit_aid == "meaningful":
            reasons.append(FitReason(label="奖学金", detail="国际学生有机会拿到有分量的奖学金"))
        elif cand.merit_aid == "none":
            reasons.append(FitReason(label="奖学金", detail="基本只有助学金，国际生几乎没有 merit 奖"))

    if prefs.class_size:
        feel = cand.class_size_feel
        if prefs.class_size == "small":
            value = {"small-seminar": 1.0, "mid-size": 0.6, "large-lecture": 0.15}.get(feel, 0.5)
        else:
            value = {"large-lecture": 1.0, "mid-size": 0.7, "small-seminar": 0.3}.get(feel, 0.5)
        parts.append(value)
        if value >= 0.9:
            label = "小班教学" if prefs.class_size == "small" else "大校资源"
            reasons.append(FitReason(label=label, detail=f"本科约 {cand.undergrad:.0f} 千人"))

    if prefs.after_graduation:
        if prefs.after_graduation == "work":
            value = {"industry": 1.0, "balanced": 0.7, "graduate-school": 0.4}.get(cand.outcome, 0.6)
        elif prefs.after_graduation in ("masters", "phd"):
            value = {"graduate-school": 1.0, "balanced": 0.7, "industry": 0.45}.get(cand.outcome, 0.6)
        else:
            value = 0.6
        parts.append(value)
        if value >= 0.95:
            detail = "毕业生以直接就业为主" if prefs.after_graduation == "work" else "读研深造比例高"
            reasons.append(FitReason(label="毕业去向", detail=detail))

    if prefs.climate:
        if prefs.climate == "warm":
            value = {"warm": 1.0, "mild": 0.6, "cold-winters": 0.15}.get(cand.climate, 0.5)
        else:
            value = 1.0 if cand.climate in ("cold-winters", "mild", "warm") else 0.5
        parts.append(value)
        if prefs.climate == "warm" and cand.climate == "warm":
            reasons.append(FitReason(label="气候", detail="冬天不冷"))

    if prefs.regions:
        hit = cand.region in prefs.regions
        parts.append(1.0 if hit else 0.2)
        if hit:
            reasons.append(FitReason(label="地区", detail=f"在你想去的区域（{cand.region}）"))

    if prefs.coastal:
        hit = cand.coastal if prefs.coastal == "coast" else not cand.coastal
        parts.append(1.0 if hit else 0.35)

    if prefs.setting:
        if prefs.setting == "big-city":
            value = {"urban": 1.0, "suburban": 0.6, "college-town": 0.35, "rural": 0.1}.get(cand.setting, 0.5)
        else:
            value = {"college-town": 1.0, "rural": 0.8, "suburban": 0.6, "urban": 0.25}.get(cand.setting, 0.5)
        parts.append(value)
        if value >= 0.95:
            wording = {"urban": "位于大城市", "suburban": "城郊", "college-town": "典型大学城", "rural": "安静的小镇"}
            reasons.append(FitReason(label="环境", detail=wording.get(cand.setting, cand.setting)))

    if not parts:
        return 0.6, reasons
    return sum(parts) / len(parts), reasons


def _fit_score(
    cand: CandidateSchool,
    category: str,
    student_sat: Optional[int],
    prefs: StudentPreferences,
) -> tuple[int, List[FitReason]]:
    """0-100 overall fit. Academics and programme dominate by design - the
    student was explicit that scores and subject strength matter most, and the
    lifestyle answers are there to choose between schools that already fit."""
    reasons: List[FitReason] = []

    # Academic fit: how close the student sits to this school's band. Being far
    # above is not a better fit than being at it - that is a safety, not a match.
    expected = _expected_sat(cand)
    if student_sat is None:
        academic = 0.5
    else:
        gap = abs(student_sat - expected)
        academic = max(0.0, 1.0 - gap / 250.0)
        confidence = "该校公布的录取区间" if cand.sat_range_known else "按录取率推算的区间"
        delta = student_sat - expected
        if abs(delta) <= 10:
            detail = f"你的 {student_sat} 正好落在{confidence}中位（{expected}）上"
        else:
            side = "高于" if delta > 0 else "低于"
            detail = f"你的 {student_sat} {side}{confidence}中位 {expected} 约 {abs(delta)} 分"
        reasons.append(FitReason(label="成绩匹配", detail=detail))

    programme = _program_match(cand, prefs.intended_major)
    if programme >= 1.0 and prefs.intended_major:
        reasons.append(FitReason(label="专业实力", detail=f"{prefs.intended_major} 是该校的强项"))

    # General academic reputation, so a strong programme at a stronger school
    # still ranks above the same programme at a weaker one.
    if cand.us_news_rank:
        reputation = max(0.0, 1.0 - (cand.us_news_rank - 1) / 160.0)
    else:
        reputation = 0.7   # liberal arts colleges sit on a separate ranking

    preference, pref_reasons = _preference_score(cand, prefs)
    reasons.extend(pref_reasons)

    score = (
        0.40 * academic
        + 0.25 * programme
        + 0.10 * reputation
        + 0.25 * preference
    )
    return round(score * 100), reasons


@router.post("/api/colleges/recommend", response_model=RecommendResponse, tags=["Colleges"])
async def recommend_colleges(body: RecommendRequest):
    """Build a balanced school list for this student.

    The ranking is arithmetic, not a language model: scores against each
    school's band, programme strength in the student's field, reputation, and
    whichever lifestyle preferences they actually answered. The model is used
    afterwards, only to write the one-sentence reason - it cannot move a school
    between buckets, add a school that was not scored, or change the order.
    That division is deliberate. A recommender that can hallucinate a safety
    school is worse than no recommender.
    """
    saved = {n.strip().lower() for n in body.saved_names}
    pool = [c for c in body.candidates if c.name.strip().lower() not in saved]
    if not pool:
        return RecommendResponse(recommendations=[])

    strength = _student_strength_score(
        body.profile_strength, body.student_sat, body.student_act, body.student_gpa
    )
    student_sat = _student_sat_equivalent(body.student_sat, body.student_act)
    prefs = body.preferences

    scored = []
    for cand in pool:
        category = _categorise(cand, student_sat, strength)
        score, reasons = _fit_score(cand, category, student_sat, prefs)
        scored.append((score, category, cand, reasons))
    scored.sort(key=lambda row: row[0], reverse=True)

    # A list that is all reaches is a fantasy and a list that is all safeties is
    # a waste of a year. Roughly a quarter reach, half target, a quarter safety,
    # and top up from whatever is left if one bucket runs short.
    target_counts = {
        "reach": max(1, round(body.count * 0.30)),
        "target": max(1, round(body.count * 0.45)),
        "safety": max(1, round(body.count * 0.25)),
    }
    picked: List[tuple] = []
    for bucket, wanted in target_counts.items():
        for row in scored:
            if len(picked) >= body.count:
                break
            if row[1] == bucket and row not in picked and sum(1 for p in picked if p[1] == bucket) < wanted:
                picked.append(row)
    for row in scored:
        if len(picked) >= body.count:
            break
        if row not in picked:
            picked.append(row)
    picked.sort(key=lambda row: row[0], reverse=True)

    # One or two early cards, spent on the best-fitting reaches that offer a
    # binding or restrictive early round. ED is the only lever an applicant has
    # that measurably changes their odds, so it belongs on a reach they would
    # genuinely attend - not on a safety, where it buys nothing.
    early_assigned = 0
    early_by_name: Dict[str, str] = {}
    for score, category, cand, _ in picked:
        if early_assigned >= 2:
            break
        if category != "reach":
            continue
        if cand.has_ed:
            early_by_name[cand.name] = "ED"
            early_assigned += 1
        elif cand.has_ea and early_assigned == 0:
            early_by_name[cand.name] = "EA"
            early_assigned += 1

    # Now the writing. The model sees the finished list and explains it.
    listing = "\n".join(
        f"- {cand.name} ({category}, fit {score}/100, ~{cand.acceptance_rate:.0f}% admit"
        + (f", 强项: {', '.join(cand.strong_programs)}" if cand.strong_programs else "")
        + f", 约 ${cand.cost_per_year}k/年)"
        for score, category, cand, _ in picked
    )
    answered = [
        f"目标专业: {prefs.intended_major}" if prefs.intended_major else "",
        f"预算上限: ${prefs.budget_per_year}k/年" if prefs.budget_per_year else "",
        "需要奖学金" if prefs.needs_scholarship else "",
        f"班级规模偏好: {prefs.class_size}" if prefs.class_size else "",
        f"毕业打算: {prefs.after_graduation}" if prefs.after_graduation else "",
        f"气候: {prefs.climate}" if prefs.climate else "",
        f"地区: {', '.join(prefs.regions)}" if prefs.regions else "",
        f"海边/内陆: {prefs.coastal}" if prefs.coastal else "",
        f"城市/小镇: {prefs.setting}" if prefs.setting else "",
    ]
    answered_text = "; ".join(a for a in answered if a) or "(还没有填写偏好)"

    system_prompt = (
        "You are a college counsellor explaining a school list you have already built. The list, the "
        "categories and the order are fixed - do not add, remove, reorder or recategorise anything.\n\n"
        "For each school write a 'rationale': ONE sentence, at most 28 words, in the same language as "
        "the student's stated preferences, saying concretely why this school suits THIS student. Use "
        "their scores, their intended major, or a preference they actually stated. Never invent a "
        "detail about the student. If nothing specific is known, say plainly that this is a starting "
        "point based on selectivity.\n\n"
        'Respond ONLY with JSON: {"recommendations": [{"name": "...", "rationale": "..."}]} '
        "with one entry per school, using the exact names given."
    )
    user_prompt = (
        f"学生成绩: {('SAT ' + str(body.student_sat)) if body.student_sat else ''}"
        f"{(' ACT ' + str(body.student_act)) if body.student_act else ''}"
        f"{(' GPA %.2f' % body.student_gpa) if body.student_gpa else ''}".strip() or "（暂无分数）"
    )
    user_prompt += f"\n学生偏好: {answered_text}\n\n已选好的学校列表:\n{listing}"

    rationales: Dict[str, str] = {}
    if llm_provider is not None:
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
            if isinstance(parsed, dict):
                for item in parsed.get("recommendations", []):
                    if isinstance(item, dict) and item.get("name"):
                        rationales[str(item["name"]).strip().lower()] = str(item.get("rationale", "")).strip()
        except Exception as e:  # noqa: BLE001
            # The list is still correct without prose. Losing the sentence is a
            # degraded result; losing the list would be a broken feature.
            logger.warning("Recommendation rationales unavailable: %s", e)

    results = [
        Recommendation(
            name=cand.name,
            category=category,
            rationale=rationales.get(cand.name.strip().lower(), ""),
            acceptance_rate=cand.acceptance_rate,
            fit_score=score,
            reasons=reasons[:4],
            early_plan=early_by_name.get(cand.name),
        )
        for score, category, cand, reasons in picked
    ]
    return RecommendResponse(recommendations=results)
