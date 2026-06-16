"""
Generate simulated student packages (transcript, standardized tests, multiple
certificates) and optionally a Common App style profile bundle (PDF/JSON/TXT)
per student, using Gemini. By default, no activity photo is generated; each
package gets a random number of certificate images between --cert-min and
--cert-max (default 3–9).

Integrates:
  - student_package_gemini_few_shot: transcript, ACT/AP/IB/SAT, certificates.
  - Profile bundle (--mapping): after those documents are generated, profile.pdf/json/txt
    are built by reading the generated images/PDFs with Gemini vision (not before).

Requirements:
    pip install google-genai tqdm reportlab Pillow

Usage:
    # Without profile bundle (same as student_package_gemini_few_shot)
    python ./student_package_with_profile_bundle.py --force --out-dir ./out --random 5

    # With profile bundle (common_app_mapping.json)
    python ./student_package_with_profile_bundle.py --force --out-dir ./out --random 5 \\
        --mapping common_app_mapping.json --profile-full

    # Profile PDF only (no JSON/TXT)
    python ./student_package_with_profile_bundle.py --mapping common_app_mapping.json \\
        --profile-pdf-only --out-dir ./out --random 3

    # Specify number of honors and activities: Generate 3 honors + 5 activities per student
    python ./student_package_with_profile_bundle.py --force --out-dir ./out --random 5 \\
        --num-honors 3 --num-activities 5 --mapping common_app_mapping.json

    # Generate only honors: 4 honor certificates per student
    python ./student_package_with_profile_bundle.py --force --out-dir ./out --random 5 \\
        --num-honors 4 --num-activities 0

    # Optional: include one activity photo (off by default)
    python ./student_package_with_profile_bundle.py --out-dir ./out --random 3 --activity-photo
"""
from __future__ import annotations

import argparse
import ast
import concurrent.futures
import csv
import datetime
import io
import difflib
from html import escape as html_escape
import json
import mimetypes
import os
import random
import re
import shutil
import sys
import time
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from google import genai
from google.genai import types
from tqdm import tqdm

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    _REPORTLAB_AVAILABLE = True
except ImportError:
    _REPORTLAB_AVAILABLE = False

try:
    from PIL import Image
    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False


# ---------- Profile bundle (inline, no external module) ----------
PROFILE_TEXT_MODEL = os.environ.get("GEMINI_TEXT_MODEL", "gemini-2.0-flash")
# Multimodal model for profile-from-documents (defaults to same as text model).
PROFILE_VISION_MODEL = os.environ.get("GEMINI_PROFILE_VISION_MODEL", PROFILE_TEXT_MODEL)
PROFILE_MAX_DOC_IMAGES = max(1, int(os.environ.get("GEMINI_PROFILE_MAX_DOC_IMAGES", "32")))
PROFILE_FUZZY_CUTOFF = float(os.environ.get("OPTION_FUZZY_CUTOFF", "0.86"))
_PROFILE_HTML_RE = re.compile(r"<[^>]+>")
_PROFILE_WS_RE = re.compile(r"\s+")


@dataclass
class ProfileField:
    short_id: str
    section: str
    subsection: str
    label: str
    typ: str
    options: List[str]
    logic: str


def _profile_strip_html(s: str) -> str:
    return _PROFILE_HTML_RE.sub(" ", s or "")


def _profile_clean_label(label: str, max_len: int = 70) -> str:
    x = _profile_strip_html(label)
    x = x.replace("Learn more", " ")
    x = re.sub(r"\(Max characters:.*?\)", "", x, flags=re.IGNORECASE)
    x = _PROFILE_WS_RE.sub(" ", x).strip()
    if "?" in x and len(x) > 60:
        x = x.split("?", 1)[0].strip()
    x = re.sub(r"^(would you like to|do you|are you|please)\s+", "", x, flags=re.IGNORECASE).strip()
    if len(x) > max_len:
        x = x[: max_len - 3].rstrip() + "..."
    return x


def _profile_normalize_text(v: Any) -> Any:
    if isinstance(v, str):
        v = re.sub(r"[\r\n\t]+", " ", v)
        v = _PROFILE_WS_RE.sub(" ", v).strip()
    return v


def _profile_value_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    return False


def _profile_normalize_choice(s: Any) -> str:
    x = "" if s is None else str(s)
    x = x.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")
    x = _profile_strip_html(x)
    x = _PROFILE_WS_RE.sub(" ", x).strip()
    x = re.sub(r"\s*,\s*", ", ", x)
    return x.lower()


def _profile_parse_options(options_raw: str) -> List[str]:
    options_raw = _profile_strip_html((options_raw or "")).strip()
    if not options_raw:
        return []
    raw_parts = [p.strip() for p in options_raw.split(",")]
    merged: List[str] = []
    buf: List[str] = []
    depth = 0
    for part in raw_parts:
        if not part:
            continue
        depth += part.count("(")
        depth -= part.count(")")
        depth = max(depth, 0)
        buf.append(part)
        if depth == 0:
            opt = ", ".join(buf).strip()
            opt = _PROFILE_WS_RE.sub(" ", opt).strip()
            if opt:
                merged.append(opt)
            buf = []
    if buf:
        opt = ", ".join(buf).strip()
        opt = _PROFILE_WS_RE.sub(" ", opt).strip()
        if opt:
            merged.append(opt)
    return merged


def _profile_load_mapping(path: Path) -> List[Dict[str, Any]]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _profile_build_fields(mapping_items: List[Dict[str, Any]]) -> List[ProfileField]:
    fields: List[ProfileField] = []
    for idx_global, it in enumerate(mapping_items, start=1):
        short_id = f"F{idx_global:06d}"
        section = (it.get("section") or "Other").strip()
        subsection = (it.get("subsection") or "Other").strip()
        label = (it.get("question_label") or "").strip()
        typ = (it.get("type") or "Text").strip()
        options = _profile_parse_options((it.get("options") or "").strip())
        logic = (it.get("logic") or "").strip()
        fields.append(ProfileField(short_id, section, subsection, label, typ, options, logic))
    return fields


def _profile_build_schema(fields: List[ProfileField]) -> str:
    lines: List[str] = []
    cur_s, cur_sub = None, None
    for f in fields:
        if f.section != cur_s:
            cur_s = f.section
            lines.append(f"\n## {f.section}")
            cur_sub = None
        if f.subsection != cur_sub:
            cur_sub = f.subsection
            lines.append(f"\n### {f.subsection}")
        opt_str = ""
        if f.typ.lower().startswith(("dropdown", "radio")):
            opt_str = f" options=[{'; '.join(f.options)}]" if f.options else " options=[]"
        logic_str = f" logic=({_profile_clean_label(f.logic, 90)})" if f.logic else ""
        lines.append(f"- key={f.short_id} | name={_profile_clean_label(f.label, 70)} | type={f.typ}{opt_str}{logic_str}")
    return "\n".join(lines).strip()


def _profile_build_prompt(
    schema_text: str,
    scope: str,
    identity_override: Optional[Dict[str, str]] = None,
    package_facts: Optional[Dict[str, Any]] = None,
) -> str:
    identity_line = ""
    if identity_override:
        first = (identity_override.get("first_name") or "").strip()
        last = (identity_override.get("last_name") or "").strip()
        if first or last:
            parts = [f'legal first/given name must be "{first}"'] if first else []
            if last:
                parts.append(f'last/family/surname must be "{last}"')
            identity_line = "\n- The applicant's " + " and ".join(parts) + ".\n"
    facts_block = ""
    if package_facts:
        facts_json = json.dumps(package_facts, ensure_ascii=False, indent=2)
        facts_block = f"""
AUTHORITATIVE PACKAGE FACTS (these values MUST appear in matching profile fields — same spelling, dates, school, GPA, coursework as on the transcript and other documents):
{facts_json}

Rules for PACKAGE FACTS:
- Where a schema field corresponds to the applicant's name, date of birth, high school, GPA, coursework, graduation year, or student ID, use ONLY the values from PACKAGE FACTS.
- For Family section fields, use the "family" object in PACKAGE FACTS when present (parents/siblings/household); do not copy the applicant's last name into emails, phones, or non-name fields.
- For Academic Interests fields, use the "academic_interests" object in PACKAGE FACTS when present; majors should align with listed courses.
- Do not invent a different birth date, school name, course list, or GPA than listed above.
"""
    return f"""You are generating ONE realistic U.S. college applicant profile (Common App style).
Fill the schema ({scope}) with plausible, consistent information.{identity_line}{facts_block}

Schema:
{schema_text}

Output rules:
- Return ONLY a valid JSON object.
- Keys MUST be the exact short ids shown as "key=F000123".
- Values: Text: single-line strings; Date: YYYY-MM-DD; Dropdown/Radio: EXACTLY ONE option from list.
- If a field is NOT visible due to logic, OMIT that key. Also OMIT any field you cannot confidently fill.
"""


def _profile_build_prompt_anchor(
    schema_text: str,
    scope: str,
    anchor_json: Dict[str, Any],
    package_facts: Optional[Dict[str, Any]] = None,
) -> str:
    anchor_str = json.dumps(anchor_json, ensure_ascii=False)
    facts_block = ""
    if package_facts:
        facts_json = json.dumps(package_facts, ensure_ascii=False, indent=2)
        facts_block = f"""

AUTHORITATIVE PACKAGE FACTS (must stay consistent with transcript/tests; use for education, testing, activities narrative where applicable):
{facts_json}
"""
    return f"""You are generating additional sections for the SAME applicant profile (Common App style).

IMPORTANT: This Profile anchor JSON is FIXED. Do NOT change the person:
{anchor_str}
{facts_block}
Now fill the schema ({scope}) consistently with the anchor and PACKAGE FACTS.

Schema:
{schema_text}

Output rules:
- Return ONLY a valid JSON object. Keys MUST be exact short ids (key=F000123).
- Values: Text: single-line; Date: YYYY-MM-DD; Dropdown/Radio: one option from list.
- OMIT fields not visible by logic or you cannot fill.
"""


def _profile_extract_json(text: str, debug_path: Optional[Path] = None) -> Dict[str, Any]:
    if text is None:
        raise ValueError("Empty model response (None).")
    s = text.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", s)
    if m:
        s = m.group(1).strip()

    def _strip_ctrl(x: str) -> str:
        return "".join(ch for ch in x if (ord(ch) >= 32) or ch in "\t\n\r")
    s1 = _strip_ctrl(s).replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")
    try:
        obj = json.loads(s1)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    lb, rb = s1.find("{"), s1.rfind("}")
    candidate = s1[lb : rb + 1].strip() if (lb != -1 and rb != -1 and rb > lb) else s1.strip()
    candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
    try:
        obj = json.loads(candidate)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    try:
        obj = ast.literal_eval(candidate)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass
    raise ValueError("Failed to parse JSON from model response.")


def _profile_coerce_dropdown(value: Any, options: List[str]) -> Optional[str]:
    if value is None:
        return None
    v = _PROFILE_WS_RE.sub(" ", str(value)).strip()
    if not options:
        return _profile_normalize_text(v)
    if v in options:
        return v
    norm_map = {_profile_normalize_choice(o): o for o in options}
    nv = _profile_normalize_choice(v)
    if nv in norm_map:
        return norm_map[nv]

    def semi_equiv(s: str) -> str:
        s = s.replace(";", ",").replace("，", ",")
        s = re.sub(r"\s*,\s*", ", ", s)
        return _profile_normalize_choice(s)
    nv2 = semi_equiv(v)
    norm_map2 = {semi_equiv(o): o for o in options}
    if nv2 in norm_map2:
        return norm_map2[nv2]
    if len(nv2) >= 40:
        for key_norm, orig in norm_map2.items():
            if nv2 in key_norm or key_norm in nv2:
                return orig
    cutoff = PROFILE_FUZZY_CUTOFF
    if len(nv2) >= 80:
        cutoff = min(cutoff, 0.80)
    elif len(nv2) >= 40:
        cutoff = min(cutoff, 0.83)
    matches = difflib.get_close_matches(nv2, list(norm_map2.keys()), n=1, cutoff=cutoff)
    if matches:
        return norm_map2[matches[0]]
    return None


def _profile_validate(profile_short: Dict[str, Any], fields: List[ProfileField]) -> Tuple[Dict[str, Any], List[str]]:
    warnings: List[str] = []
    out = dict(profile_short)
    fmap = {f.short_id: f for f in fields}
    for sid, v in list(out.items()):
        f = fmap.get(sid)
        if f is None:
            continue
        if f.typ.lower().startswith(("dropdown", "radio")):
            coerced = _profile_coerce_dropdown(v, f.options)
            if v is not None and coerced is None:
                out[sid] = None
            else:
                out[sid] = coerced
        else:
            out[sid] = _profile_normalize_text(v)
    return out, warnings


def _profile_first_value(profile: Dict[str, Any], fields: List[ProfileField], section: str, contains: str) -> Optional[Any]:
    c = contains.lower()
    for f in fields:
        if f.section != section:
            continue
        if c in _profile_clean_label(f.label, 200).lower():
            v = profile.get(f.short_id)
            if v is not None and str(v).strip():
                return v
    return None


def _profile_build_all_details(profile_short: Dict[str, Any], fields: List[ProfileField]) -> Dict[str, Dict[str, List[Dict[str, Any]]]]:
    """Build section/subsection items for PDF/TXT; dedupe repeated mapping slots (e.g. multiple 'Degree received')."""
    out: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
    _parent_edu_label_markers = (
        "degree received",
        "year received",
        "college lookup",
        "number of degrees your parent",
        "total number of institutions",
    )
    seen_parent_labels: set[Tuple[str, str, str]] = set()
    for f in fields:
        v = profile_short.get(f.short_id)
        if v is None or (isinstance(v, str) and not v.strip()):
            continue
        name = _profile_clean_label(f.label, 60)
        if f.section == "Family" and f.subsection in ("Parent 1", "Parent 2"):
            lab = name.lower()
            if any(m in lab for m in _parent_edu_label_markers):
                key = (f.section, f.subsection, lab)
                if key in seen_parent_labels:
                    continue
                seen_parent_labels.add(key)
        out.setdefault(f.section, {}).setdefault(f.subsection, []).append({
            "name": name,
            "value": _profile_normalize_text(v),
        })
    return out


def _profile_build_clean(profile_short: Dict[str, Any], fields_all: List[ProfileField]) -> Dict[str, Any]:
    first_name = _profile_first_value(profile_short, fields_all, "Profile", "Legal first/given name")
    last_name = _profile_first_value(profile_short, fields_all, "Profile", "Last/family/surname")
    middle_name = _profile_first_value(profile_short, fields_all, "Profile", "Middle name")
    dob = _profile_first_value(profile_short, fields_all, "Profile", "Date of birth")
    return {
        "identity": {"first_name": first_name, "middle_name": middle_name, "last_name": last_name, "date_of_birth": dob},
        "sections": _profile_build_all_details(profile_short, fields_all),
    }


def _profile_to_txt(clean_profile: Dict[str, Any]) -> str:
    ident = clean_profile.get("identity", {})
    name = " ".join([x for x in [ident.get("first_name"), ident.get("middle_name"), ident.get("last_name")] if x]) or "Applicant Profile"
    lines = [name, "=" * max(20, len(name)), ""]
    for sec, subs in (clean_profile.get("sections") or {}).items():
        lines.append(sec)
        lines.append("-" * len(sec))
        for sub, items in subs.items():
            lines.append(f"  {sub}")
            for it in items:
                lines.append(f"    - {it['name']}: {it['value']}")
            lines.append("")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _profile_build_pdf(
    clean_profile: Dict[str, Any],
    out_pdf: Path,
    *,
    package_facts: Optional[Dict[str, Any]] = None,
    source_note: Optional[str] = None,
) -> None:
    if not _REPORTLAB_AVAILABLE:
        raise RuntimeError("reportlab is required for profile PDF. Install with: pip install reportlab")
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=20, spaceAfter=10)
    h1 = ParagraphStyle("H1", parent=styles["Heading2"], fontSize=13, spaceBefore=10, spaceAfter=6)
    h2 = ParagraphStyle("H2", parent=styles["Heading3"], fontSize=11, spaceBefore=6, spaceAfter=4)
    normal = ParagraphStyle("NormalSmall", parent=styles["Normal"], fontSize=10, leading=13)
    ident = clean_profile.get("identity", {})
    name = " ".join([x for x in [ident.get("first_name"), ident.get("middle_name"), ident.get("last_name")] if x]) or "Applicant Profile"
    name_esc = html_escape(name, quote=False)
    doc = SimpleDocTemplate(
        str(out_pdf), pagesize=letter,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        title=name,
    )
    story: List[Any] = []
    story.append(Paragraph(name_esc, title_style))
    note = source_note or "Generated profile (result-only)."
    story.append(Paragraph(html_escape(note, quote=False), normal))
    story.append(Spacer(1, 0.15 * inch))
    if package_facts:
        sch = package_facts.get("school") or {}
        ai = package_facts.get("academic_interests") or {}
        extras = [
            ("High school (generation)", sch.get("name")),
            ("Student ID (generation)", str(package_facts.get("student_id", ""))),
            ("Graduation year (generation)", str(package_facts.get("graduation_year", ""))),
            ("Cumulative GPA (generation)", str(package_facts.get("cumulative_gpa", ""))),
        ]
        if ai.get("undecided_about_major") == "Yes":
            extras.append(("Intended major (generation)", "Undecided"))
        elif ai.get("intended_major"):
            extras.append(("Intended major (generation)", ai.get("intended_major")))
        if ai.get("second_choice_major"):
            extras.append(("Second choice major (generation)", ai.get("second_choice_major")))
        if ai.get("additional_interests"):
            extras.append(("Additional interests (generation)", ai.get("additional_interests")))
        rows_pf = []
        for k, v in extras:
            if v:
                rows_pf.append(
                    [Paragraph(f"<b>{html_escape(k, quote=False)}</b>", normal), Paragraph(html_escape(str(v), quote=False), normal)]
                )
        if rows_pf:
            story.append(Paragraph("Generation facts (matches transcript prompts)", h1))
            tpf = Table(rows_pf, colWidths=[2.0 * inch, 4.8 * inch])
            tpf.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.lightgrey)]))
            story.append(tpf)
            story.append(Spacer(1, 0.12 * inch))
    story.append(Paragraph("Summary", h1))
    summary_rows = []
    for k, v in [("First name", ident.get("first_name")), ("Middle name", ident.get("middle_name")), ("Last name", ident.get("last_name")), ("Date of birth", ident.get("date_of_birth"))]:
        if v:
            summary_rows.append(
                [Paragraph(f"<b>{html_escape(k, quote=False)}</b>", normal), Paragraph(html_escape(str(v), quote=False), normal)]
            )
    if summary_rows:
        t = Table(summary_rows, colWidths=[2.0 * inch, 4.8 * inch])
        t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.lightgrey)]))
        story.append(t)
    else:
        story.append(Paragraph("—", normal))
    story.append(Paragraph("All Provided Details", h1))
    sections = clean_profile.get("sections") or {}
    if not sections:
        story.append(Paragraph("No additional fields extracted into sections (see Generation facts above if applicable).", normal))
    else:
        for sec, subs in sections.items():
            story.append(Paragraph(html_escape(sec, quote=False), h2))
            for sub, items in subs.items():
                story.append(Paragraph(html_escape(sub, quote=False), ParagraphStyle("Sub", parent=normal, fontSize=10, spaceAfter=4)))
                table_rows = []
                for it in items:
                    k, v = it["name"], it["value"]
                    v_str = json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else str(v)
                    v_str = _PROFILE_WS_RE.sub(" ", v_str).strip()
                    table_rows.append(
                        [
                            Paragraph(f"<b>{html_escape(k, quote=False)}</b>", normal),
                            Paragraph(html_escape(v_str, quote=False), normal),
                        ]
                    )
                if table_rows:
                    t = Table(table_rows, colWidths=[2.3 * inch, 4.5 * inch])
                    t.setStyle(TableStyle([
                        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.lightgrey),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]))
                    story.append(t)
                story.append(Spacer(1, 0.08 * inch))
    doc.build(story)


def _profile_save_json(path: Path, obj: Dict[str, Any]) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _profile_is_boilerplate_field(f: ProfileField) -> bool:
    """Instructional/UI copy in the mapping — not applicant data."""
    lab = _profile_clean_label(f.label, 500).lower()
    if len(lab) > 120 and "?" not in lab:
        return True
    if "common app and member colleges may communicate" in lab:
        return True
    if lab.startswith("ustrive is a common app partner"):
        return True
    return False


def _profile_field_expects_email(f: ProfileField) -> bool:
    lab = _profile_clean_label(f.label, 200).lower()
    return "email" in lab


def _profile_field_expects_phone_number(f: ProfileField) -> bool:
    lab = _profile_clean_label(f.label, 200).lower()
    return "phone number" in lab or (lab.endswith("phone") and "preferred" not in lab and f.typ.lower().startswith("text"))


def _profile_field_expects_person_name(f: ProfileField) -> bool:
    lab = _profile_clean_label(f.label, 200).lower()
    if "first" in lab and ("given" in lab or "name" in lab):
        return True
    if ("last" in lab or "surname" in lab or "family" in lab) and "name" in lab:
        return True
    if "middle initial" in lab or "middle name" in lab:
        return True
    return False


def _profile_sanitize_field_value(
    f: ProfileField, value: Any, package_facts: Optional[Dict[str, Any]]
) -> Optional[Any]:
    """Drop values that are the wrong shape for the field (e.g. surname in an email field)."""
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    if _profile_is_boilerplate_field(f):
        return None
    v = _profile_normalize_text(value)
    if not isinstance(v, str):
        return v
    facts = package_facts or {}
    student_last = (facts.get("last_name") or "").strip()
    student_first = (facts.get("first_name") or "").strip()
    lab = _profile_clean_label(f.label, 200).lower()

    if _profile_field_expects_email(f):
        if "@" not in v or v.strip().lower() == student_last.lower():
            return None
        return v
    if _profile_field_expects_phone_number(f):
        digits = re.sub(r"\D", "", v)
        if len(digits) < 7 or v.strip().lower() == student_last.lower():
            return None
        return v
    if "first" in lab and ("given" in lab or "name" in lab):
        if v.strip().lower() == student_last.lower() and student_first and v.strip().lower() != student_first.lower():
            return None
        if len(v.split()) > 2:
            return None
        return v
    if ("last" in lab or "surname" in lab) and "former" not in lab:
        if v.strip().lower() == student_first.lower() and student_last:
            return None
    return v


def _profile_sanitize_short(
    profile_short: Dict[str, Any],
    fields_all: List[ProfileField],
    package_facts: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    out = dict(profile_short)
    for f in fields_all:
        sid = f.short_id
        if sid not in out:
            continue
        cleaned = _profile_sanitize_field_value(f, out[sid], package_facts)
        if cleaned is None:
            out.pop(sid, None)
        else:
            out[sid] = cleaned
    return out


def _profile_prune_inactive_sibling_fields(
    profile_short: Dict[str, Any], fields_all: List[ProfileField]
) -> Dict[str, Any]:
    """Remove sibling N fields when the declared sibling count is less than N."""
    out = dict(profile_short)
    num_siblings: Optional[int] = None
    triplets: List[List[ProfileField]] = []
    current: List[ProfileField] = []
    for f in fields_all:
        if f.section != "Family" or f.subsection != "Sibling":
            continue
        lab = _profile_clean_label(f.label, 200).lower()
        if "number of siblings" in lab:
            raw = out.get(f.short_id)
            if raw is not None:
                try:
                    num_siblings = int(str(raw).strip())
                except ValueError:
                    num_siblings = 0
            continue
        current.append(f)
        if len(current) == 3:
            triplets.append(current)
            current = []
    if num_siblings is None:
        return out
    for idx, trio in enumerate(triplets):
        if idx >= num_siblings:
            for ff in trio:
                out.pop(ff.short_id, None)
    return out


_PARENT_COLLEGE_NAMES = [
    "University of Michigan",
    "Ohio State University",
    "UCLA",
    "University of Texas at Austin",
    "Pennsylvania State University",
    "University of Florida",
    "Arizona State University",
    "University of Washington",
]

_PARENT_EDUCATION_LABEL_MARKERS = (
    "total number of institutions",
    "college lookup",
    "number of degrees your parent",
    "degree received",
    "year received",
    "college/university employer",
)


def _profile_is_parent_college_chain_field(f: ProfileField) -> bool:
    if f.section != "Family" or f.subsection not in ("Parent 1", "Parent 2"):
        return False
    lab = _profile_clean_label(f.label, 200).lower()
    return any(m in lab for m in _PARENT_EDUCATION_LABEL_MARKERS)


def _profile_build_parent_education_detail() -> Dict[str, Any]:
    year_ba = random.randint(1985, 2002)
    degrees: List[Dict[str, str]] = [{"type": "Bachelor's (BA, BS)", "year": str(year_ba)}]
    if random.random() < 0.3:
        degrees.append({"type": "Master's (MA, MS)", "year": str(year_ba + random.randint(2, 6))})
    return {
        "institutions": "1",
        "college": random.choice(_PARENT_COLLEGE_NAMES),
        "num_degrees": str(len(degrees)),
        "degrees": degrees,
    }


def _profile_clear_parent_college_chain(
    profile_short: Dict[str, Any], fields_all: List[ProfileField], subsection: str
) -> None:
    for f in fields_all:
        if f.section != "Family" or f.subsection != subsection:
            continue
        if _profile_is_parent_college_chain_field(f):
            profile_short.pop(f.short_id, None)


def _profile_apply_parent_education_to_short(
    profile_short: Dict[str, Any],
    fields_all: List[ProfileField],
    subsection: str,
    edu: Dict[str, Any],
) -> None:
    """One college + N degree/year pairs only; clears duplicate mapping slots first."""
    _profile_clear_parent_college_chain(profile_short, fields_all, subsection)
    degrees: List[Dict[str, str]] = list(edu.get("degrees") or [])
    if not degrees:
        return

    set_inst = False
    set_college = False
    set_numdeg = False
    deg_i = 0

    for f in fields_all:
        if f.section != "Family" or f.subsection != subsection:
            continue
        lab = _profile_clean_label(f.label, 200).lower()
        sid = f.short_id

        if "total number of institutions" in lab:
            if not set_inst:
                profile_short[sid] = str(edu.get("institutions", "1"))
                set_inst = True
            continue
        if not set_inst:
            continue
        if "college lookup" in lab:
            if not set_college:
                profile_short[sid] = (edu.get("college") or "").strip()
                set_college = True
            continue
        if "number of degrees your parent" in lab:
            if not set_numdeg and set_college:
                profile_short[sid] = str(edu.get("num_degrees", str(len(degrees))))
                set_numdeg = True
            continue
        if not set_numdeg:
            continue
        if "degree received" in lab:
            if deg_i < len(degrees):
                profile_short[sid] = degrees[deg_i]["type"]
            continue
        if "year received" in lab:
            if deg_i < len(degrees):
                profile_short[sid] = degrees[deg_i]["year"]
                deg_i += 1


def _profile_skip_gap_fill_field(f: ProfileField) -> bool:
    """Fields set structurally from package_facts.family — gap-fill must not duplicate slots."""
    if _profile_is_boilerplate_field(f):
        return True
    if _profile_is_parent_college_chain_field(f):
        return True
    if f.section == "Family" and f.subsection in ("Parent 1", "Parent 2"):
        lab = _profile_clean_label(f.label, 200).lower()
        if "other prefix" in lab:
            return True
        if lab == "suffix":
            return True
    if f.section == "Family" and f.subsection == "Sibling":
        return True
    return False


_PARENT_EMPLOYERS_BY_OCCUPATION: Dict[str, List[str]] = {
    "Business executive (management, administrator)": [
        "Summit Holdings LLC",
        "Midwest Financial Group",
        "Harbor Point Partners",
        "Northgate Industries",
    ],
    "Engineer": [
        "Brightline Engineering Inc.",
        "Precision Systems Group",
        "Lakeview Manufacturing",
        "Atlas Infrastructure",
    ],
    "Nurse": [
        "Mercy Regional Medical Center",
        "St. Joseph Community Hospital",
        "Riverside Health Clinic",
    ],
    "Lawyer (attorney) or judge": [
        "Morrison & Cole LLP",
        "Baker Legal Associates",
        "County Circuit Court",
    ],
    "Computer programmer or analyst": [
        "DataStream Technologies",
        "CloudNine Software",
        "Innotech Solutions",
    ],
}

_GENERIC_EMPLOYERS = [
    "Community Services Office",
    "Regional Operations Center",
    "Metro Business Services",
]


def _employer_name_for_occupation(occupation: str, school_name: str = "") -> str:
    """Plausible employer (company, firm, or school) matching the parent's occupation."""
    occ = (occupation or "").lower()
    if any(
        x in occ
        for x in (
            "teacher",
            "administrator (secondary)",
            "administrator (elementary)",
            "school counselor",
            "school principal",
            "college teacher",
            "college administrator",
        )
    ):
        return (school_name or "").strip() or "Lincoln High School"
    pool = _PARENT_EMPLOYERS_BY_OCCUPATION.get(occupation) or _GENERIC_EMPLOYERS
    return random.choice(pool)


def _build_siblings_list(student_last_name: str, count: int, applicant_birth_year: Optional[int] = None) -> List[Dict[str, str]]:
    """Build 0–5 siblings with unique first names and ages plausible for a high-school applicant."""
    if count <= 0:
        return []
    last = (student_last_name or "Smith").strip() or "Smith"
    birth_year = applicant_birth_year or random.randint(2006, 2010)
    applicant_age = max(14, min(19, datetime.datetime.now().year - birth_year))
    first_names = [
        "Emma", "Noah", "Olivia", "Liam", "Ava", "Sophia", "Ethan", "Mia",
        "Lucas", "Chloe", "Mason", "Harper", "Logan", "Ella", "Jacob", "Grace",
    ]
    random.shuffle(first_names)
    siblings: List[Dict[str, str]] = []
    for i in range(count):
        first = first_names[i % len(first_names)]
        if i > 0 and first == siblings[-1]["first_name"]:
            first = first_names[(i + 3) % len(first_names)]
        if random.random() < 0.7:
            age = random.randint(8, max(8, applicant_age - 1))
        else:
            age = random.randint(applicant_age + 1, min(26, applicant_age + 9))
        siblings.append({"first_name": first, "last_name": last, "age": str(age)})
    return siblings


def build_family_facts(
    student_last_name: str,
    school_name: str = "",
    applicant_birth_year: Optional[int] = None,
) -> Dict[str, Any]:
    """Coherent synthetic Family section data (parents/siblings) separate from applicant Profile."""
    last = (student_last_name or "Smith").strip() or "Smith"
    sch = (school_name or "").strip()
    mother_first = random.choice(["Sarah", "Jennifer", "Maria", "Emily", "Lisa", "Patricia", "Karen", "Susan"])
    father_first = random.choice(["James", "Michael", "David", "Robert", "John", "Richard", "Thomas", "Daniel"])
    p1_type = random.choice(["Mother", "Father"])
    if p1_type == "Mother":
        p1_first, p2_first, p2_type = mother_first, father_first, "Father"
        p1_prefix = "Ms."
        p2_prefix = "Mr."
    else:
        p1_first, p2_first, p2_type = father_first, mother_first, "Mother"
        p1_prefix = "Mr."
        p2_prefix = "Ms."

    def _phone() -> str:
        return f"({random.randint(200, 989)}) {random.randint(200, 989)}-{random.randint(1000, 9999)}"

    def _parent_block(first: str, ptype: str, prefix: str) -> Dict[str, str]:
        local = re.sub(r"[^a-z0-9]", "", first.lower()) or "parent"
        occupation = random.choice(
            [
                "Teacher or administrator (secondary)",
                "Business executive (management, administrator)",
                "Engineer",
                "Nurse",
                "Lawyer (attorney) or judge",
                "Computer programmer or analyst",
            ]
        )
        return {
            "type": ptype,
            "living": "Yes",
            "prefix": prefix,
            "first_name": first,
            "last_name": last,
            "former_last_name": "",
            "email": f"{local}.{last.lower()}@gmail.com",
            "phone_type": "Mobile",
            "phone_number": _phone(),
            "occupation": occupation,
            "employer_name": _employer_name_for_occupation(occupation, sch),
            "college_employment": "Not employed at a college/university",
            "education": "Graduated from college/university",
            "employment_status": "Employed",
            "education_detail": _profile_build_parent_education_detail(),
        }

    num_siblings = str(
        random.choices(
            [0, 1, 2, 3, 4, 5],
            weights=[12, 22, 24, 20, 14, 8],
            k=1,
        )[0]
    )
    siblings = _build_siblings_list(last, int(num_siblings), applicant_birth_year=applicant_birth_year)

    return {
        "household": {
            "parents_marital_status": "Married",
            "permanent_home": "Both Parents",
            "has_children": "No",
            "num_siblings": num_siblings,
        },
        "parent1": _parent_block(p1_first, p1_type, p1_prefix),
        "parent2": _parent_block(p2_first, p2_type, p2_prefix),
        "siblings": siblings,
    }


def _profile_apply_family_facts_to_short(
    profile_short: Dict[str, Any],
    fields_all: List[ProfileField],
    family: Dict[str, Any],
) -> None:
    """Map structured family facts onto Family section fields only."""
    hh = family.get("household") or {}
    p1 = family.get("parent1") or {}
    p2 = family.get("parent2") or {}
    siblings: List[Dict[str, str]] = list(family.get("siblings") or [])

    for f in fields_all:
        if f.section != "Family":
            continue
        if _profile_is_boilerplate_field(f):
            profile_short.pop(f.short_id, None)
            continue
        sid = f.short_id
        lab = _profile_clean_label(f.label, 500).lower()
        sub = (f.subsection or "").strip()

        if sub == "Household":
            if "marital status" in lab:
                profile_short[sid] = hh.get("parents_marital_status", "")
            elif "permanent home" in lab:
                profile_short[sid] = hh.get("permanent_home", "")
            elif "have any children" in lab:
                profile_short[sid] = hh.get("has_children", "No")
            continue

        if sub == "Sibling":
            continue

        parent = p1 if sub == "Parent 1" else p2 if sub == "Parent 2" else None
        if not parent:
            continue

        if "parent" in lab and "type" in lab:
            profile_short[sid] = parent.get("type", "")
        elif "living" in lab:
            profile_short[sid] = parent.get("living", "Yes")
        elif lab == "prefix":
            profile_short[sid] = parent.get("prefix", "")
        elif "other prefix" in lab:
            if (parent.get("prefix") or "").strip() == "Other":
                profile_short[sid] = parent.get("other_prefix", "Mx.")
            else:
                profile_short.pop(sid, None)
        elif lab == "suffix":
            profile_short.pop(sid, None)
        elif "college/university employer" in lab:
            profile_short.pop(sid, None)
        elif "first" in lab and ("given" in lab or "name" in lab):
            profile_short[sid] = parent.get("first_name", "")
        elif "middle initial" in lab:
            mid = parent.get("first_name", "")
            profile_short[sid] = mid[0] if mid else ""
        elif ("last" in lab or "surname" in lab) and "former" not in lab:
            profile_short[sid] = parent.get("last_name", "")
        elif "former" in lab and ("last" in lab or "surname" in lab):
            former = (parent.get("former_last_name") or "").strip()
            if former:
                profile_short[sid] = former
            else:
                profile_short.pop(sid, None)
        elif "preferred email" in lab:
            profile_short[sid] = parent.get("email", "")
        elif "preferred phone" in lab and f.typ.lower().startswith(("dropdown", "radio")):
            profile_short[sid] = parent.get("phone_type", "Mobile")
        elif "phone number" in lab:
            profile_short[sid] = parent.get("phone_number", "")
        elif "occupation" in lab and "other occupation" not in lab:
            profile_short[sid] = parent.get("occupation", "")
        elif "name of current employer" in lab:
            if (parent.get("employment_status") or "").strip() == "Employed":
                emp = (parent.get("employer_name") or "").strip()
                if emp:
                    profile_short[sid] = emp
                else:
                    profile_short.pop(sid, None)
            else:
                profile_short.pop(sid, None)
        elif "employed by or retired from a college" in lab:
            profile_short[sid] = parent.get("college_employment", "")
        elif "highest education" in lab:
            profile_short[sid] = parent.get("education", "")
        elif "employment status" in lab:
            profile_short[sid] = parent.get("employment_status", "")

    for subsection, parent in (("Parent 1", p1), ("Parent 2", p2)):
        edu = parent.get("education_detail")
        if edu:
            _profile_apply_parent_education_to_short(profile_short, fields_all, subsection, edu)

    _profile_apply_sibling_facts_to_short(profile_short, fields_all, hh, siblings)


def _profile_apply_sibling_facts_to_short(
    profile_short: Dict[str, Any],
    fields_all: List[ProfileField],
    household: Dict[str, Any],
    siblings: List[Dict[str, str]],
) -> None:
    """Apply sibling count and per-sibling first/last/age; clear unused sibling slots."""
    num_sib = int(household.get("num_siblings", "0") or "0")
    if num_sib < 0:
        num_sib = 0
    if num_sib > 5:
        num_sib = 5

    for f in fields_all:
        if f.section != "Family" or f.subsection != "Sibling":
            continue
        profile_short.pop(f.short_id, None)

    sib_triplets: List[List[ProfileField]] = []
    current: List[ProfileField] = []
    for f in fields_all:
        if f.section != "Family" or f.subsection != "Sibling":
            continue
        lab = _profile_clean_label(f.label, 200).lower()
        if "number of siblings" in lab or "specify number of siblings" in lab:
            profile_short[f.short_id] = str(num_sib)
            continue
        current.append(f)
        if len(current) == 3:
            sib_triplets.append(current)
            current = []

    for idx, trio in enumerate(sib_triplets):
        if idx >= num_sib:
            continue
        sib = siblings[idx] if idx < len(siblings) else {}
        for ff in trio:
            lab = _profile_clean_label(ff.label, 200).lower()
            if "first" in lab and ("given" in lab or "name" in lab):
                profile_short[ff.short_id] = sib.get("first_name", "")
            elif ("last" in lab or "surname" in lab) or lab == "last/family/surname":
                profile_short[ff.short_id] = sib.get("last_name", "")
            elif lab == "age" or lab.endswith(" age"):
                profile_short[ff.short_id] = sib.get("age", "")


# Course keywords -> plausible college majors (used to align interests with transcript coursework).
_COURSE_MAJOR_TRACKS: List[Tuple[str, List[str]]] = [
    ("computer science", ["Computer Science", "Software Engineering", "Information Systems"]),
    ("biology", ["Biology", "Environmental Science", "Pre-Medicine"]),
    ("chemistry", ["Chemistry", "Biochemistry", "Chemical Engineering"]),
    ("physics", ["Physics", "Engineering Physics", "Astrophysics"]),
    ("calculus", ["Mathematics", "Applied Mathematics", "Statistics"]),
    ("algebra", ["Mathematics", "Economics", "Finance"]),
    ("economics", ["Economics", "Business Administration", "Public Policy"]),
    ("history", ["History", "Political Science", "International Relations"]),
    ("government", ["Political Science", "Public Policy", "International Relations"]),
    ("spanish", ["Spanish", "International Studies", "Linguistics"]),
    ("french", ["French", "International Studies", "Linguistics"]),
    ("art", ["Studio Art", "Graphic Design", "Art History"]),
    ("music", ["Music", "Music Performance", "Music Education"]),
    ("english", ["English", "Creative Writing", "Journalism"]),
]


def build_academic_interests_facts(courses: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Derive intended/second majors and additional interests from the student's generated coursework
    so Academic Interests stays consistent with the transcript profile.
    """
    course_names = [(c.get("course") or "").strip() for c in courses if (c.get("course") or "").strip()]
    major_scores: Dict[str, int] = {}
    matched_subjects: List[str] = []

    for cname in course_names:
        c_low = cname.lower()
        for keyword, majors in _COURSE_MAJOR_TRACKS:
            if keyword in c_low:
                matched_subjects.append(cname)
                for m in majors:
                    major_scores[m] = major_scores.get(m, 0) + 1

    undecided = random.random() < 0.12
    if undecided:
        extras = [n for n in course_names if n not in matched_subjects]
        if not extras:
            extras = course_names[:3]
        additional = ", ".join(extras[:4]) if extras else "Exploring several fields before declaring a major"
        return {
            "intended_major": "",
            "undecided_about_major": "Yes",
            "second_choice_major": "",
            "additional_interests": additional,
        }

    if major_scores:
        ranked = sorted(major_scores.items(), key=lambda x: (-x[1], x[0]))
        intended = ranked[0][0]
        second = ranked[1][0] if len(ranked) > 1 and ranked[1][1] > 0 else ""
        if not second:
            track_majors = next((majors for kw, majors in _COURSE_MAJOR_TRACKS if kw in intended.lower()), None)
            if track_majors and len(track_majors) > 1:
                alts = [m for m in track_majors if m != intended]
                second = random.choice(alts) if alts else ""
    else:
        intended = random.choice(
            [
                "Psychology",
                "Business Administration",
                "Communications",
                "Sociology",
                "Undeclared Arts & Sciences",
            ]
        )
        second = random.choice(["Economics", "Political Science", "English", ""])

    primary_kw = ""
    for kw, majors in _COURSE_MAJOR_TRACKS:
        if intended in majors:
            primary_kw = kw
            break
    interest_bits: List[str] = []
    for cname in course_names:
        c_low = cname.lower()
        if primary_kw and primary_kw in c_low:
            continue
        interest_bits.append(cname)
    if second:
        interest_bits.append(f"Also considering {second}")
    additional = ", ".join(dict.fromkeys(interest_bits[:5]))
    if not additional:
        additional = ", ".join(course_names[:4])

    return {
        "intended_major": intended,
        "undecided_about_major": "No",
        "second_choice_major": second,
        "additional_interests": additional,
    }


def _profile_apply_academic_interests_to_short(
    profile_short: Dict[str, Any],
    fields_all: List[ProfileField],
    academic: Dict[str, Any],
) -> None:
    """Map structured academic_interests onto Academic Interests section fields."""
    undecided = (academic.get("undecided_about_major") or "").strip() == "Yes"
    for f in fields_all:
        if f.section != "Academic Interests":
            continue
        sid = f.short_id
        lab = _profile_clean_label(f.label, 200).lower()
        if "undecided about major" in lab:
            profile_short[sid] = academic.get("undecided_about_major", "No")
        elif "intended major" in lab:
            if undecided:
                profile_short.pop(sid, None)
            else:
                val = (academic.get("intended_major") or "").strip()
                if val:
                    profile_short[sid] = val
                else:
                    profile_short.pop(sid, None)
        elif "second choice major" in lab:
            if undecided:
                profile_short.pop(sid, None)
            else:
                val = (academic.get("second_choice_major") or "").strip()
                if val:
                    profile_short[sid] = val
                else:
                    profile_short.pop(sid, None)
        elif "additional interests" in lab:
            val = (academic.get("additional_interests") or "").strip()
            if val:
                profile_short[sid] = val
            else:
                profile_short.pop(sid, None)


def _profile_apply_facts_to_short(
    profile_short: Dict[str, Any],
    fields_all: List[ProfileField],
    facts: Dict[str, Any],
) -> None:
    """Align model output with PACKAGE FACTS for applicant Profile (and school/GPA in Education only)."""
    school = facts.get("school") or {}
    sch_name = school.get("name") or ""
    addr_parts = [school.get("address"), school.get("city"), school.get("state_abbr"), school.get("zip")]
    sch_addr = ", ".join(p for p in addr_parts if p)

    for f in fields_all:
        sid = f.short_id
        lab = _profile_clean_label(f.label, 500).lower()
        if f.section == "Profile":
            if "legal first" in lab or lab.startswith("first name"):
                profile_short[sid] = facts["first_name"]
            elif ("last" in lab and ("surname" in lab or "family" in lab)) or lab == "last name":
                profile_short[sid] = facts["last_name"]
            elif "middle name" in lab:
                mid = facts.get("middle_name")
                if mid:
                    profile_short[sid] = mid
            elif "date of birth" in lab or lab == "birthday":
                profile_short[sid] = facts["date_of_birth"]
        if f.section in ("Profile", "Education"):
            if ("high school" in lab or "secondary school" in lab) and ("name" in lab or "you attend" in lab):
                profile_short[sid] = sch_name
            elif "school address" in lab or ("high school" in lab and "address" in lab):
                profile_short[sid] = sch_addr or school.get("address") or ""
            elif "cumulative" in lab and "gpa" in lab:
                profile_short[sid] = str(facts.get("cumulative_gpa", ""))


def _profile_postprocess_short(
    profile_short: Dict[str, Any],
    fields_all: List[ProfileField],
    package_facts: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    out = _profile_sanitize_short(profile_short, fields_all, package_facts)
    out = _profile_prune_inactive_sibling_fields(out, fields_all)
    if package_facts:
        fam = package_facts.get("family") or {}
        for subsection, key in (("Parent 1", "parent1"), ("Parent 2", "parent2")):
            edu = (fam.get(key) or {}).get("education_detail")
            if edu:
                _profile_apply_parent_education_to_short(out, fields_all, subsection, edu)
        hh = fam.get("household") or {}
        sibs = list(fam.get("siblings") or [])
        _profile_apply_sibling_facts_to_short(out, fields_all, hh, sibs)
    return out


def _profile_deterministic_placeholder_for_field(
    f: ProfileField, package_facts: Optional[Dict[str, Any]]
) -> str:
    """Last-resort synthetic value so PDF rows can exist when the model cannot gap-fill."""
    t = (f.typ or "").strip().lower()
    facts = package_facts or {}
    if t.startswith(("dropdown", "radio")) and f.options:
        norms = [_profile_normalize_choice(o) for o in f.options]
        if len(f.options) == 2 and "yes" in norms and "no" in norms:
            return f.options[norms.index("no")]
        return f.options[0]
    if t == "date":
        dob = facts.get("date_of_birth")
        if dob:
            return str(dob).strip()
        return "2006-06-15"
    lab = _profile_clean_label(f.label, 500)
    lab_l = lab.lower()
    fn = (facts.get("first_name") or "The applicant").strip() or "The applicant"
    sch = ""
    if isinstance(facts.get("school"), dict):
        sch = (facts["school"].get("name") or "").strip()
    ctx = f"{fn}" + (f" at {sch}" if sch else "")
    if "essay" in lab_l or "personal statement" in lab_l or "character" in lab_l or len(lab) > 180:
        return (
            f"{ctx} addresses this prompt for synthetic pipeline data. "
            f"The response is coherent, first-person where appropriate, and suitable for UI testing; "
            f"it references coursework and goals consistent with the rest of this generated package."
        )
    return f"{ctx} — {lab}"


def _profile_compact_lines_for_gap_fill(fields: List[ProfileField]) -> str:
    lines: List[str] = []
    for f in fields:
        lab = _profile_clean_label(f.label, 120).replace("\n", " ")
        opt_str = ""
        if f.typ.lower().startswith(("dropdown", "radio")) and f.options:
            opts = f.options[:120]
            opt_str = " options=[" + "; ".join(opts) + "]"
        logic_hint = ""
        if (f.logic or "").strip():
            logic_hint = f" | logic={_profile_clean_label(f.logic, 140)}"
        lines.append(f"- key={f.short_id} | type={f.typ} | name={lab}{opt_str}{logic_hint}")
    return "\n".join(lines)


def _profile_gap_fill_missing_fields(
    client: genai.Client,
    fields_all: List[ProfileField],
    profile_short: Dict[str, Any],
    package_facts: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    After vision/text extraction, optionally fill missing fields when they are appropriate and
    consistent with available evidence. Non-applicable/unknown fields may remain blank.
    Disabled with PROFILE_FILL_ALL_FIELDS=0.
    """
    if os.environ.get("PROFILE_FILL_ALL_FIELDS", "1").lower() in ("0", "false", "no"):
        return profile_short

    chunk_sz = max(5, int(os.environ.get("PROFILE_GAP_FILL_CHUNK_SIZE", "40")))
    max_rounds = max(1, int(os.environ.get("PROFILE_GAP_FILL_ROUNDS", "3")))
    out: Dict[str, Any] = dict(profile_short)

    for _ in range(max_rounds):
        missing_fields = [
            f
            for f in fields_all
            if _profile_value_missing(out.get(f.short_id)) and not _profile_skip_gap_fill_field(f)
        ]
        if not missing_fields:
            break
        for i in range(0, len(missing_fields), chunk_sz):
            chunk = missing_fields[i : i + chunk_sz]
            schema_chunk = _profile_compact_lines_for_gap_fill(chunk)
            partial_json = json.dumps(out, ensure_ascii=False)
            pf_json = json.dumps(package_facts, ensure_ascii=False, indent=2) if package_facts else "{}"
            allowed_ids = {f.short_id for f in chunk}
            prompt = f"""You complete a synthetic U.S. college applicant Common App profile for UI/testing data.

Current profile JSON (non-empty values are authoritative — do not contradict):
{partial_json}

AUTHORITATIVE generation facts (same person as transcript/certificates; align names, school, GPA, DOB when applicable):
{pf_json}

TASK: Return ONLY a JSON object. Fill ONLY fields from SCHEMA below that are clearly applicable and can be inferred reasonably from:
- the existing profile JSON context
- the authoritative generation facts
- internal consistency across this same applicant profile
If a field is not applicable, unknown, or would require guessing, OMIT that key.

Rules:
- Keys MUST be exactly the key=Fxxxxxx ids from SCHEMA (same ids as listed).
- Dropdown/Radio: value must be EXACTLY one string from the options list for that field.
- Date: YYYY-MM-DD where the field is a date.
- Long essay prompts: respond with a plausible concise essay (under 650 words; prefer 200–400 words unless schema implies shorter).
- Short text: single line when possible.
- Make answers mutually consistent (same applicant).
- Prefer leaving conditional/dependent questions blank when their parent condition is not clearly satisfied.
- Do not force completion of every key.
- Email fields: use a valid email (must contain @), never a bare surname or first name.
- Phone number fields: use a realistic phone number with digits, never a person's name.
- Parent/sibling names: use realistic given names; last names may match the student's family name when appropriate.
- If package_facts includes a "family" object, use those parent/sibling values for Family section fields and do not contradict them (including parent employer_name, household.num_siblings, and siblings[] first/last/age).
- If package_facts includes "academic_interests", use those values for Academic Interests (intended major, undecided, second choice, additional interests) and align with the student's courses/GPA narrative.
- Never put the student's last name into email, phone, or instructional/boilerplate fields.
- Do NOT fill Parent college/degree chain fields (institutions attended, college lookup, number of degrees, degree received, year received); those come from package_facts.family.education_detail.

SCHEMA (consider these missing fields and fill only appropriate ones):
{schema_chunk}

Return ONLY valid JSON with double-quoted strings.
"""
            try:
                delta = _profile_generate_with_gemini(client, prompt)
                if isinstance(delta, dict):
                    for k, v in delta.items():
                        if k not in allowed_ids:
                            continue
                        if v is None:
                            continue
                        if isinstance(v, str) and not v.strip():
                            continue
                        out[k] = v
            except Exception:
                continue
            validated, _ = _profile_validate(out, fields_all)
            out = dict(validated)

    if os.environ.get("PROFILE_DETERMINISTIC_FALLBACK", "0").lower() not in ("0", "false", "no"):
        for f in fields_all:
            if not _profile_value_missing(out.get(f.short_id)):
                continue
            out[f.short_id] = _profile_deterministic_placeholder_for_field(f, package_facts)
        validated, _ = _profile_validate(out, fields_all)
        out = dict(validated)

    return out


def _profile_generate_with_gemini(client: genai.Client, prompt: str) -> Dict[str, Any]:
    max_retries = max(1, int(os.environ.get("GEMINI_PROFILE_RETRIES", "6")))
    base_delay = float(os.environ.get("GEMINI_PROFILE_RETRY_DELAY_SEC", "2"))
    for attempt in range(max_retries):
        try:
            try:
                resp = client.models.generate_content(
                    model=PROFILE_TEXT_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0,
                        max_output_tokens=8192,
                    ),
                )
            except Exception:
                resp = client.models.generate_content(model=PROFILE_TEXT_MODEL, contents=prompt)
            raw = getattr(resp, "text", None) or ""
            if not raw and getattr(resp, "candidates", None):
                for c in resp.candidates:
                    if getattr(c, "content", None) and getattr(c.content, "parts", None):
                        for p in c.content.parts:
                            if getattr(p, "text", None):
                                raw = p.text
                                break
                    if raw:
                        break
            if not raw:
                raise RuntimeError("Gemini returned no text.")
            return _profile_extract_json(raw)
        except Exception as exc:
            if attempt < max_retries - 1 and is_retryable_api_throttle(exc):
                delay = min(120.0, base_delay * (2**attempt)) + random.uniform(0, 1.5)
                time.sleep(delay)
                continue
            raise


def _profile_build_prompt_extract_profile_section(schema_text: str, identity_hint: Optional[Dict[str, str]] = None) -> str:
    hint = ""
    if identity_hint:
        f0 = (identity_hint.get("first_name") or "").strip()
        l0 = (identity_hint.get("last_name") or "").strip()
        if f0 or l0:
            hint = f'\nHint: CSV row suggests first name "{f0}" and last name "{l0}" — use only if they match the transcript.\n'
    return f"""You are given one or more images/PDFs of synthetic applicant documents (transcript, test score reports, certificates, etc.).

Task: Read ONLY text that is **visible** in the attached documents. Fill the Profile section schema below (Profile).
{hint}
Rules:
- Copy names, dates, school, GPA, and IDs as printed when they appear on the documents.
- If you cannot see a value for a field on the documents, OMIT that key (do not guess from prior knowledge).

Schema (Profile section only):
{schema_text}

Output rules:
- Return ONLY a valid JSON object.
- Keys MUST be the exact short ids shown as "key=F000123".
- Values: Text: single-line strings; Date: YYYY-MM-DD; Dropdown/Radio: EXACTLY ONE option from list.
"""


def _profile_build_prompt_extract_non_profile(
    schema_text: str,
    anchor_short: Dict[str, Any],
) -> str:
    anchor_str = json.dumps(anchor_short, ensure_ascii=False)
    return f"""The same applicant documents are attached again as images/PDFs.

You already extracted this Profile JSON (fixed — do not contradict):
{anchor_str}

Task: Read the documents and fill the schema below for all **non-Profile** sections only. Use information visible on the documents.

Schema:
{schema_text}

Output rules:
- Return ONLY a valid JSON object. Keys MUST be exact short ids (key=F000123).
- Values: Text: single-line; Date: YYYY-MM-DD; Dropdown/Radio: one option from list.
- OMIT keys you cannot support from document text or consistent inference.
"""


def _profile_generate_with_gemini_multimodal(
    client: genai.Client,
    prompt: str,
    image_paths: List[Path],
) -> Dict[str, Any]:
    """Vision + JSON: attach up to PROFILE_MAX_DOC_IMAGES document files."""
    existing = [p for p in image_paths if p.exists()]
    if not existing:
        raise ValueError("No document image files exist for profile extraction.")
    trimmed = existing[:PROFILE_MAX_DOC_IMAGES]
    max_retries = max(1, int(os.environ.get("GEMINI_PROFILE_RETRIES", "6")))
    base_delay = float(os.environ.get("GEMINI_PROFILE_RETRY_DELAY_SEC", "2"))

    def _collect_raw(resp: Any) -> str:
        raw = getattr(resp, "text", None) or ""
        if not raw and getattr(resp, "candidates", None):
            for c in resp.candidates:
                if getattr(c, "content", None) and getattr(c.content, "parts", None):
                    for pt in c.content.parts:
                        if getattr(pt, "text", None):
                            raw = pt.text
                            break
                if raw:
                    break
        return raw

    for attempt in range(max_retries):
        try:
            parts: List[types.Part] = [types.Part.from_text(text=prompt)]
            for path in trimmed:
                mime = mimetypes.guess_type(path.name)[0]
                if not mime:
                    mime = "application/pdf" if path.suffix.lower() == ".pdf" else "image/png"
                parts.append(image_part_from_bytes(path.read_bytes(), mime))
            try:
                resp = client.models.generate_content(
                    model=PROFILE_VISION_MODEL,
                    contents=parts,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0,
                        max_output_tokens=8192,
                    ),
                )
            except Exception:
                resp = client.models.generate_content(model=PROFILE_VISION_MODEL, contents=parts)
            raw = _collect_raw(resp)
            if not raw:
                raise RuntimeError("Gemini returned no text for multimodal profile extraction.")
            return _profile_extract_json(raw)
        except Exception as exc:
            if attempt < max_retries - 1 and is_retryable_api_throttle(exc):
                delay = min(120.0, base_delay * (2**attempt)) + random.uniform(0, 1.5)
                time.sleep(delay)
                continue
            raise


def generate_one_profile(
    client: genai.Client,
    mapping_path: Path,
    output_dir: Path,
    *,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    full: bool = True,
    pdf_only: bool = False,
    save_stages: bool = False,
    package_facts: Optional[Dict[str, Any]] = None,
) -> Tuple[Path, Dict[str, Any]]:
    """Text-only profile generation (legacy). Prefer generate_profile_from_document_images in the main pipeline."""
    if not mapping_path.exists():
        raise FileNotFoundError(f"Mapping file not found: {mapping_path}")
    mapping_items = _profile_load_mapping(mapping_path)
    fields_all = _profile_build_fields(mapping_items)
    profile_fields = [f for f in fields_all if f.section == "Profile"]
    if not profile_fields:
        raise ValueError('No "Profile" section in mapping.')
    identity_override = None
    if (first_name or "").strip() or (last_name or "").strip():
        identity_override = {"first_name": (first_name or "").strip(), "last_name": (last_name or "").strip()}
    two_stage = full
    if two_stage:
        schema1 = _profile_build_schema(profile_fields)
        prompt1 = _profile_build_prompt(
            schema1, "Profile (anchor)", identity_override=identity_override, package_facts=package_facts
        )
        raw1 = _profile_generate_with_gemini(client, prompt1)
        stage1_short, _ = _profile_validate(raw1, profile_fields)
        stage2_fields = [f for f in fields_all if f.section != "Profile"]
        schema2 = _profile_build_schema(stage2_fields)
        prompt2 = _profile_build_prompt_anchor(
            schema2, "All non-Profile sections", stage1_short, package_facts=package_facts
        )
        raw2 = _profile_generate_with_gemini(client, prompt2)
        stage2_short, _ = _profile_validate(raw2, stage2_fields)
        profile_short = dict(stage1_short)
        profile_short.update(stage2_short)
    else:
        schema = _profile_build_schema(profile_fields)
        prompt = _profile_build_prompt(schema, "Profile", identity_override=identity_override, package_facts=package_facts)
        raw = _profile_generate_with_gemini(client, prompt)
        profile_short, _ = _profile_validate(raw, profile_fields)
    if package_facts:
        _profile_apply_facts_to_short(profile_short, fields_all, package_facts)
    profile_short = _profile_gap_fill_missing_fields(client, fields_all, profile_short, package_facts)
    profile_short, _ = _profile_validate(profile_short, fields_all)
    if package_facts:
        fam = package_facts.get("family")
        if fam:
            _profile_apply_family_facts_to_short(profile_short, fields_all, fam)
        acad = package_facts.get("academic_interests")
        if acad:
            _profile_apply_academic_interests_to_short(profile_short, fields_all, acad)
        profile_short, _ = _profile_validate(profile_short, fields_all)
    profile_short = _profile_postprocess_short(profile_short, fields_all, package_facts)
    clean_profile = _profile_build_clean(profile_short, fields_all)
    if package_facts:
        clean_profile["identity"] = {
            "first_name": package_facts["first_name"],
            "middle_name": package_facts.get("middle_name") or clean_profile.get("identity", {}).get("middle_name"),
            "last_name": package_facts["last_name"],
            "date_of_birth": package_facts["date_of_birth"],
        }
    output_dir.mkdir(parents=True, exist_ok=True)
    out_pdf = output_dir / "profile.pdf"
    out_json = output_dir / "profile.json"
    out_txt = output_dir / "profile.txt"
    _profile_build_pdf(
        clean_profile,
        out_pdf,
        package_facts=package_facts,
        source_note="Filled from Common App mapping via text model (fallback / legacy).",
    )
    if not pdf_only:
        _profile_save_json(out_json, clean_profile)
        out_txt.write_text(_profile_to_txt(clean_profile), encoding="utf-8")
    return (out_pdf, clean_profile)


def generate_profile_from_document_images(
    client: genai.Client,
    mapping_path: Path,
    output_dir: Path,
    document_paths: List[Path],
    *,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    full: bool = True,
    pdf_only: bool = False,
    package_facts: Optional[Dict[str, Any]] = None,
) -> Tuple[Path, Dict[str, Any]]:
    """
    Fill the Common App mapping from generated document images/PDFs using Gemini vision, then write profile outputs.
    PROFILE_MERGE_PACKAGE_FACTS (default 1): merge package_facts into mapping fields after OCR so PDFs are not blank.
    PROFILE_FILL_ALL_FIELDS (default 1): text model attempts smart gap-fill for appropriate missing fields.
    PROFILE_DETERMINISTIC_FALLBACK (default 0): if enabled, force-fill still-empty keys with synthetic placeholders.
    """
    if not mapping_path.exists():
        raise FileNotFoundError(f"Mapping file not found: {mapping_path}")
    paths = [p for p in document_paths if p.exists()]
    if not paths:
        raise ValueError("No document images supplied for profile extraction.")

    mapping_items = _profile_load_mapping(mapping_path)
    fields_all = _profile_build_fields(mapping_items)
    profile_fields = [f for f in fields_all if f.section == "Profile"]
    if not profile_fields:
        raise ValueError('No "Profile" section in mapping.')

    identity_hint = None
    if (first_name or "").strip() or (last_name or "").strip():
        identity_hint = {"first_name": (first_name or "").strip(), "last_name": (last_name or "").strip()}

    merge_extra = os.environ.get("PROFILE_MERGE_PACKAGE_FACTS", "1").lower() not in ("0", "false", "no")

    two_stage = full
    if two_stage:
        schema1 = _profile_build_schema(profile_fields)
        prompt1 = _profile_build_prompt_extract_profile_section(schema1, identity_hint=identity_hint)
        raw1 = _profile_generate_with_gemini_multimodal(client, prompt1, paths)
        stage1_short, _ = _profile_validate(raw1, profile_fields)
        stage2_fields = [f for f in fields_all if f.section != "Profile"]
        schema2 = _profile_build_schema(stage2_fields)
        prompt2 = _profile_build_prompt_extract_non_profile(schema2, stage1_short)
        raw2 = _profile_generate_with_gemini_multimodal(client, prompt2, paths)
        stage2_short, _ = _profile_validate(raw2, stage2_fields)
        profile_short = dict(stage1_short)
        profile_short.update(stage2_short)
    else:
        schema = _profile_build_schema(profile_fields)
        prompt = _profile_build_prompt_extract_profile_section(schema, identity_hint=identity_hint)
        raw = _profile_generate_with_gemini_multimodal(client, prompt, paths)
        profile_short, _ = _profile_validate(raw, profile_fields)

    # Always align mapping fields we can from package_facts so PDF/JSON are not blank when OCR misses labels.
    if package_facts and merge_extra:
        _profile_apply_facts_to_short(profile_short, fields_all, package_facts)

    profile_short = _profile_gap_fill_missing_fields(client, fields_all, profile_short, package_facts)
    profile_short, _ = _profile_validate(profile_short, fields_all)
    if package_facts and merge_extra:
        fam = package_facts.get("family")
        if fam:
            _profile_apply_family_facts_to_short(profile_short, fields_all, fam)
        acad = package_facts.get("academic_interests")
        if acad:
            _profile_apply_academic_interests_to_short(profile_short, fields_all, acad)
        profile_short, _ = _profile_validate(profile_short, fields_all)
    profile_short = _profile_postprocess_short(profile_short, fields_all, package_facts)

    clean_profile = _profile_build_clean(profile_short, fields_all)
    if package_facts:
        clean_profile["identity"] = {
            "first_name": package_facts["first_name"],
            "middle_name": package_facts.get("middle_name") or clean_profile.get("identity", {}).get("middle_name"),
            "last_name": package_facts["last_name"],
            "date_of_birth": package_facts["date_of_birth"],
        }

    output_dir.mkdir(parents=True, exist_ok=True)
    out_pdf = output_dir / "profile.pdf"
    out_json = output_dir / "profile.json"
    out_txt = output_dir / "profile.txt"
    _profile_build_pdf(
        clean_profile,
        out_pdf,
        package_facts=package_facts,
        source_note=(
            "Compiled from generated document images (vision). "
            "Summary uses generation facts for name/DOB/GPA/school when fields match your mapping."
        ),
    )
    if not pdf_only:
        _profile_save_json(out_json, clean_profile)
        out_txt.write_text(_profile_to_txt(clean_profile), encoding="utf-8")
    return (out_pdf, clean_profile)


# ---------- End profile bundle inline ----------

# Paths
WORKSPACE_ROOT = Path(__file__).resolve().parent
DEFAULT_OUTPUT_ROOT = WORKSPACE_ROOT / "output"
DEFAULT_MAPPING_PATH = WORKSPACE_ROOT / "common_app_mapping.json"

# Real templates
US_REAL_ROOT = Path("./US_real_data")
TEMPLATE_TRANSCRIPT_ROOT = US_REAL_ROOT / "US_transcript"
TEMPLATE_STDTEST_ROOT = US_REAL_ROOT / "US_standard_test"
TEMPLATE_CERT_ROOT = US_REAL_ROOT / "US_certificates"

# Input data
SCHOOLS_CSV = Path("./us_high_schools_by_county.csv")
STUDENTS_CSV = Path("./students_50k.csv")

# Cache file for certificate titles
CERT_TITLE_CACHE_FILE = WORKSPACE_ROOT / "certificate_titles_cache.json"

# Generation settings
DEFAULT_API_KEY = os.environ.get("GEMINI_API_KEY") or "AIzaSyA-ALASI9YW8B1EVIwYfSMJCCD0PFg8M-Y"
MODEL_NAME = os.environ.get("GEMINI_MODEL_NAME", "gemini-3-pro-image-preview")
ALLOWED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".pdf"}
MAX_SCHOOLS = int(os.getenv("MAX_SCHOOLS", "-1"))  # -1 means all
MAX_STUDENTS_PER_SCHOOL = int(os.getenv("MAX_STUDENTS_PER_SCHOOL", "-1"))  # -1 means all

# Simple high-school course pool to guide the model
HS_COURSES = [
    "English Literature",
    "Algebra II",
    "Pre-Calculus",
    "Biology",
    "Chemistry",
    "Physics",
    "US History",
    "World History",
    "Economics",
    "Government",
    "Spanish II",
    "French II",
    "Computer Science Principles",
    "Health Education",
    "Physical Education",
    "Art",
    "Music Theory",
]


def sanitize_name(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("_")
    return cleaned or "unknown"


def image_part_from_bytes(data: bytes, mime_type: str) -> types.Part:
    if hasattr(types.Part, "from_image"):
        return types.Part.from_image(data=data, mime_type=mime_type)
    if hasattr(types.Part, "from_bytes"):
        return types.Part.from_bytes(data=data, mime_type=mime_type)
    return types.Part(inline_data=types.Blob(data=data, mime_type=mime_type))


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def pick_templates(root: Path) -> List[Path]:
    """Return all allowed image templates under root."""
    candidates = sorted(
        [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in ALLOWED_IMAGE_EXTS]
    )
    if not candidates:
        raise FileNotFoundError(f"No template images found under {root}")
    return candidates


def pick_random_file(root: Path) -> Path:
    candidates = pick_templates(root)
    return random.choice(candidates)


def pick_random_from_subfolders(root: Path) -> Path:
    """Pick a random subfolder then random file inside."""
    subfolders = [p for p in root.iterdir() if p.is_dir()]
    if not subfolders:
        raise FileNotFoundError(f"No subfolders under {root}")
    folder = random.choice(subfolders)
    return pick_random_file(folder)


def load_csv_rows(csv_path: Path) -> List[Dict[str, str]]:
    with csv_path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_high_schools(random_pick: int = -1, number_pick: int = -1) -> List[Dict[str, str]]:
    schools = load_csv_rows(SCHOOLS_CSV)
    if random_pick and random_pick > 0:
        schools = random.sample(schools, min(random_pick, len(schools)))
        return schools
    if number_pick and number_pick > 0:
        return schools[: min(number_pick, len(schools))]
    return schools


def load_students() -> List[Dict[str, str]]:
    return load_csv_rows(STUDENTS_CSV)


_GRADE_TO_POINTS = {
    "A": 4.0,
    "A-": 3.7,
    "B+": 3.3,
    "B": 3.0,
    "B-": 2.7,
    "C+": 2.3,
    "C": 2.0,
    "C-": 1.7,
}


def build_package_facts(school: Dict[str, str], student: Dict[str, str]) -> Dict[str, Any]:
    """
    One authoritative fact set per student package: transcript, tests, certificates, and profile
    (--mapping) must all use these values so generated documents stay consistent.
    """
    first = (student.get("first_name") or "").strip()
    last = (student.get("last_name") or "").strip()
    middle = (student.get("middle_name") or "").strip()

    address_parts = [
        school.get("address", "").strip(),
        school.get("city", "").strip(),
        school.get("state_abbr", "").strip(),
        school.get("zip", "").strip(),
    ]
    address = ", ".join([part for part in address_parts if part])

    courses_sel = random.sample(HS_COURSES, k=min(8, len(HS_COURSES)))
    grade_options = ["A", "A-", "B+", "B", "B-", "A"]
    courses: List[Dict[str, Any]] = []
    total_pts = 0.0
    total_cr = 0.0
    for cname in courses_sel:
        g = random.choice(grade_options)
        cr = float(random.choice([0.5, 1.0]))
        gp = _GRADE_TO_POINTS.get(g, 3.0)
        total_pts += gp * cr
        total_cr += cr
        courses.append({"course": cname, "grade": g, "credits": cr})
    cumulative_gpa = round(total_pts / total_cr, 2) if total_cr else 3.5

    grad_year = random.randint(2018, 2025)
    student_id = f"{random.randint(100000, 999999)}"
    birth_year = random.randint(2006, 2010)
    birth_month = random.randint(1, 12)
    birth_day = random.randint(1, 28)
    dob = f"{birth_year:04d}-{birth_month:02d}-{birth_day:02d}"

    cand_9 = f"{random.randint(100000000, 999999999)}"
    reg_id = f"{random.randint(10000000, 99999999)}"

    course_lines = "\n".join(f"- {c['course']}: {c['grade']} ({c['credits']} credits)" for c in courses)

    return {
        "first_name": first,
        "last_name": last,
        "middle_name": middle or None,
        "date_of_birth": dob,
        "student_id": student_id,
        "graduation_year": grad_year,
        "cumulative_gpa": cumulative_gpa,
        "program": "Standard high school curriculum",
        "courses": courses,
        "course_list_for_prompt": course_lines,
        "school": {
            "name": school.get("school_name", "").strip(),
            "address": address or "N/A",
            "phone": school.get("phone", "").strip() or "N/A",
            "city": school.get("city", "").strip(),
            "state_abbr": school.get("state_abbr", "").strip(),
            "zip": school.get("zip", "").strip(),
        },
        "testing": {
            "candidate_id_9": cand_9,
            "registration_id": reg_id,
        },
        "family": build_family_facts(
            last,
            school_name=school.get("school_name", "").strip(),
            applicant_birth_year=birth_year,
        ),
        "academic_interests": build_academic_interests_facts(courses),
    }


def build_transcript_prompt(template_path: Path, package_facts: Dict[str, Any]) -> str:
    sch = package_facts["school"]
    dob_line = f"\n- Date of Birth: {package_facts['date_of_birth']}"
    display_name = " ".join(
        x for x in [package_facts["first_name"], package_facts.get("middle_name"), package_facts["last_name"]] if x
    )
    return f"""
Based only on the layout and visual structure of the attached image, generate a synthetic, non-official transcript-style document for UI/design mockups.
Keep layout, fonts, spacing, and visual hierarchy the same; only edit text fields with fictional but plausible data. Do NOT add real school logos/seals; if present, leave as-is or replace with neutral placeholders.

School:
- Name: {sch['name']}
- Address: {sch['address']}
- Phone: {sch['phone']}

Student:
- Name: {display_name}
- Student ID: {package_facts['student_id']}{dob_line}
- Graduation year: {package_facts['graduation_year']}
- Program: {package_facts['program']}

Academics (use EXACTLY this course list, grades, credits, and GPA — do not substitute other courses or recalculate a different GPA):
{package_facts['course_list_for_prompt']}
- Cumulative GPA (must display this value): {package_facts['cumulative_gpa']}

Rules:
- Preserve all visual elements from the template image so it looks like a direct edit of the template.
- Keep the file format the same as the template ({template_path.suffix.lower()}).
- Do not add watermarks or extra logos; if the template has branding, keep or replace with neutral shapes, never invent real institutions.
"""


def few_shot_examples_transcript() -> List[types.Part]:
    """Few-shot exemplars to reduce hallucinations for transcripts."""
    examples = [
        (
            "School: North Valley High School, Address: 123 Main St, Denver, CO 80202, Phone: 303-555-0101\n"
            "Student: Alex Johnson, ID: 482913, Grad Year: 2024, Program: Standard HS Curriculum\n"
            "Courses: English Literature (A), Algebra II (A-), Biology (B+), US History (A-), Spanish II (A)\n"
            "Final GPA: 3.7 (computed from listed courses; consistent with grades)\n"
            "Instructions respected: layout unchanged, seals/signatures kept, only text updated, same file format."
        ),
        (
            "School: Lakeside STEM Academy, Address: 9 Lake Rd, Seattle, WA 98101, Phone: 206-555-0142\n"
            "Student: Priya Sharma, ID: 739104, Grad Year: 2023, Program: Standard HS Curriculum\n"
            "Courses: Chemistry (A), Pre-Calculus (A-), World History (A), Health Education (B+), Art (A-)\n"
            "Final GPA: 3.6 (computed from listed courses; consistent with grades)\n"
            "Instructions respected: kept original logo and stamps, no extra graphics, grades realistic."
        ),
    ]
    return [types.Part.from_text(text=ex) for ex in examples]


def build_stdtest_prompt(test_name: str, template_path: Path, package_facts: Dict[str, Any]) -> str:
    pf = package_facts
    sch = pf["school"]
    student_name = " ".join(
        x for x in [pf["first_name"], pf.get("middle_name"), pf["last_name"]] if x
    )
    school_name = sch["name"]
    dob_line = f"\n- Date of Birth: {pf['date_of_birth']}"
    testing = pf.get("testing") or {}
    id_line = f"\n- Use this exact candidate / registration ID where the form shows a student or registration number: {testing.get('candidate_id_9', '')}"
    id_line += f"\n- Alternate ID (use if layout has a separate registration field): {testing.get('registration_id', '')}"
    if test_name == "AP":
        return f"""
Based only on the layout and visual structure of the attached image, generate a synthetic, non-official AP-style score card for UI/design mockups.

Goal: Create a visually similar placeholder document for a fictional student.

Student:
- Name: {student_name}
- High School: {school_name}{dob_line}{id_line}

Visual and content rules (strict):
1) Layout: replicate overall structure, table alignment, font hierarchy, and spacing exactly like the template.
2) Branding/Logos: DO NOT include real institutional names, logos, seals, watermarks, or trademarks. Replace any such area with a generic gray/white geometric shape placeholder.
3) Data: List 4-6 AP subjects with scores 1-5 (mostly 3-5, maybe one 2). Include plausible exam years.
4) Security features: Replace barcode/QR with a generic black-white patterned box. Use the EXACT candidate ID given above for any student ID field.
5) Tone: Professional, clean document mock-up; not a photo/scan; concise official-style wording.
6) Keep the same file format as the template ({template_path.suffix.lower()}), and do not add new decorative graphics beyond placeholders.
"""
    if test_name in {"ACT", "SAT", "IB"}:
        guidance_extra = {
            "ACT": "Include composite and section scores (English, Math, Reading, Science) with realistic ranges; add a plausible test date and fictional candidate ID.",
            "SAT": "Include total and section scores (Reading/Writing, Math) with realistic ranges; add a plausible test date and fictional candidate ID.",
            "IB": "Include subject scores 1-7 and total points; add session info if present; use fictional candidate/session IDs.",
        }.get(test_name, "")
        return f"""
Based only on the layout and visual structure of the attached image, generate a synthetic, non-official {test_name}-style score card for UI/design mockups.

Goal: Visually similar placeholder document for a fictional student.

Student:
- Name: {student_name}
- High School: {school_name}{dob_line}{id_line}

Visual and content rules (strict):
1) Layout: replicate structure, tables, font hierarchy, spacing as in template.
2) Branding/Logos: DO NOT include real institutional names/logos/seals/watermarks/trademarks. Replace any such area with neutral gray/white shapes.
3) Data: Use plausible scores and dates; keep concise official-style wording. {guidance_extra}
4) Security features: Replace barcode/QR with a generic black-white patterned box. Use the EXACT candidate and registration IDs given above wherever those fields appear.
5) Tone: Professional, clean document mock-up; not a photo/scan; no extra decorations.
6) Keep the same file format as the template ({template_path.suffix.lower()}), no added graphics beyond placeholders.
"""
    test_guidance = {
        "ACT": "Include composite and section scores (English, Math, Reading, Science). Use realistic dates and ACT-style layout.",
        "SAT": "Include total and section scores (Reading/Writing, Math). Use SAT-style layout with realistic dates.",
        "IB": "Include subject scores (1-7) and total points. Keep IB layout and candidate/session info if present.",
    }
    guidance = test_guidance.get(test_name, "Use realistic scores and official layout for this exam.")
    return f"""
You are updating a real {test_name} score report for a high school student.
Use the attached image as the visual template. Keep layout, logos, barcodes, fonts, and styling unchanged; only replace text with new data.

Student:
- Name: {student_name}
- High School: {school_name}{dob_line}{id_line}

Rules:
- Keep the file format the same as the template ({template_path.suffix.lower()}).
- Do not add new logos or graphics. Only modify text fields with plausible scores/dates.
- Keep the style consistent with official {test_name} reports.
 - {guidance}
"""


def build_certificate_prompt(template_path: Path, package_facts: Dict[str, Any]) -> str:
    award = random.choice(
        [
            "Academic Excellence",
            "Leadership",
            "Community Service",
            "STEM Achievement",
            "Arts Achievement",
            "Athletic Achievement",
            #"Athletic Triumph",
            #"Athletic Accomplishment",
            #"Performance Award",
            #"Distinction",
            #"Accolade",
            #"Honor",
            #"Certificate of Excellence",
            #"Leadership Award",
            #"Most Valuable Player (MVP)",
            #"Most Improved Player",
        ]
    )
    pf = package_facts
    sch = pf["school"]
    student_name = " ".join(x for x in [pf["first_name"], pf.get("middle_name"), pf["last_name"]] if x)
    school_name = sch["name"]
    dob_line = f"\nDate of Birth: {pf['date_of_birth']}"
    return f"""
Based only on the layout and visual structure of the attached image, generate a synthetic, non-official certificate-style document for UI/design mockups.
Keep layout, fonts, spacing, and visual hierarchy the same; only edit text fields with fictional but plausible data. Do NOT add real school logos/seals; if present, leave as-is or replace with neutral placeholders.

Student: {student_name}
School: {school_name}{dob_line}
Award: {award}

Rules:
- Keep the file format the same as the template ({template_path.suffix.lower()}).
- Do not add new logos or watermarks; replace any branding with neutral shapes if needed. Only edit text fields.
"""


# ---------- New multi-certificate generation with title extraction ----------

def extract_certificate_title(client: genai.Client, template_path: Path) -> Optional[str]:
    """
    Extract the award/activity title from a certificate template using Gemini vision.
    Returns the main award title (e.g., "Youth Poetry Workshop")
    """
    mime_type = mimetypes.guess_type(template_path.name)[0] or "image/png"
    template_bytes = template_path.read_bytes()
    
    prompt = """
Analyze this certificate image and extract ONLY the main award/activity/recognition title.

Look for phrases like:
- "In recognition of outstanding participation in [TITLE]"
- "Award of Recognition for [TITLE]"
- "Certificate of Achievement in [TITLE]"
- "[TITLE] Award"

Examples from the image format:
- If it says "In recognition of outstanding participation in A Youth Poetry Workshop", return: "Youth Poetry Workshop"
- If it says "National Honor Society Certificate", return: "National Honor Society"
- If it says "Debate Team Captain Award", return: "Debate Team Captain"

Return ONLY the core title/activity name as a short phrase (2-6 words), without generic words like "Award", "Certificate", "Recognition" unless they're part of the official name.
Output format: Just the title text, nothing else.
"""
    
    contents = [
        types.Part.from_text(text=prompt),
        image_part_from_bytes(template_bytes, mime_type),
    ]
    
    try:
        response = client.models.generate_content(
            model=PROFILE_TEXT_MODEL,  # Use text model for extraction
            contents=contents,
        )
        title = getattr(response, "text", "").strip()
        # Clean up the response
        title = title.replace('"', '').replace("'", '').replace('`', '').strip()
        # Remove common prefixes/suffixes
        for prefix in ["Certificate of ", "Award of ", "Recognition for "]:
            if title.startswith(prefix):
                title = title[len(prefix):].strip()
        if title and len(title) < 100:  # Sanity check
            return title
    except Exception:
        pass
    
    return None


def preload_certificate_titles(
    client: genai.Client, 
    logger: Logger,
    sleep_seconds: float = 0.5,
    max_titles: int = 2000
) -> Dict[Path, str]:
    """
    Extract titles from a random sample of certificate templates upfront (done once per run).
    Uses persistent disk cache to avoid re-extracting titles on subsequent runs.
    Returns a dictionary mapping template path to extracted title.
    """
    cert_title_cache: Dict[Path, str] = {}
    
    # Try to load existing cache from disk
    if CERT_TITLE_CACHE_FILE.exists():
        try:
            with CERT_TITLE_CACHE_FILE.open('r', encoding='utf-8') as f:
                cache_data = json.load(f)
            # Convert string paths back to Path objects
            cert_title_cache = {Path(k): v for k, v in cache_data.items()}
            logger.log(f"Loaded {len(cert_title_cache)} cached certificate titles from {CERT_TITLE_CACHE_FILE.name}", to_console=True)
            
            # Verify cached templates still exist
            valid_cache = {k: v for k, v in cert_title_cache.items() if k.exists()}
            if len(valid_cache) < len(cert_title_cache):
                removed_count = len(cert_title_cache) - len(valid_cache)
                logger.log(f"Removed {removed_count} stale cache entries (templates no longer exist)", to_console=True)
                cert_title_cache = valid_cache
            
            # If we have enough cached titles, return them
            if len(cert_title_cache) >= max_titles:
                logger.log(f"Using {max_titles} titles from cache (total cached: {len(cert_title_cache)})", to_console=True)
                # Return a random sample if cache is larger than needed
                sampled_items = dict(random.sample(list(cert_title_cache.items()), max_titles))
                return sampled_items
            else:
                logger.log(f"Cache has {len(cert_title_cache)} titles, need {max_titles}. Will extract more.", to_console=True)
        except Exception as exc:
            logger.log(f"[WARN] Failed to load cache file: {exc}. Will rebuild cache.", to_console=True)
            cert_title_cache = {}
    
    try:
        all_templates = pick_templates(TEMPLATE_CERT_ROOT)
    except FileNotFoundError as exc:
        logger.log(f"[WARN] No certificate templates found: {exc}", to_console=False)
        return cert_title_cache
    
    # Filter out already cached templates
    cached_paths = set(cert_title_cache.keys())
    uncached_templates = [t for t in all_templates if t not in cached_paths]
    
    # Determine how many more we need to extract
    needed = max_titles - len(cert_title_cache)
    
    if needed > 0 and uncached_templates:
        # Randomly sample from uncached templates
        templates_to_extract = random.sample(uncached_templates, min(needed, len(uncached_templates)))
        logger.log(f"Extracting titles from {len(templates_to_extract)} new certificate templates (already cached: {len(cert_title_cache)})...", to_console=True)
        
        for template in tqdm(templates_to_extract, desc="Certificate titles", unit="cert"):
            try:
                title = extract_certificate_title(client, template)
                if title:
                    cert_title_cache[template] = title
                else:
                    # Fallback to filename
                    fallback_title = template.stem.replace('_', ' ').replace('-', ' ').title()
                    cert_title_cache[template] = fallback_title
                    logger.log(f"[FALLBACK] Using filename as title for {template.name}: {fallback_title}", to_console=False)
                maybe_sleep(sleep_seconds)
            except Exception as exc:
                logger.log(f"[WARN] Failed to extract title from {template.name}: {exc}", to_console=False)
                # Fallback to filename
                fallback_title = template.stem.replace('_', ' ').replace('-', ' ').title()
                cert_title_cache[template] = fallback_title
        
        # Save updated cache to disk
        try:
            cache_data = {str(k): v for k, v in cert_title_cache.items()}
            with CERT_TITLE_CACHE_FILE.open('w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
            logger.log(f"Saved {len(cert_title_cache)} certificate titles to cache file: {CERT_TITLE_CACHE_FILE.name}", to_console=True)
        except Exception as exc:
            logger.log(f"[WARN] Failed to save cache file: {exc}", to_console=False)
    
    logger.log(f"Total available certificate titles: {len(cert_title_cache)}", to_console=True)
    return cert_title_cache


def build_certificate_prompt_with_title(
    template_path: Path,
    award_title: str,
    package_facts: Dict[str, Any],
) -> str:
    """
    Build certificate prompt using extracted award title from template.
    This personalizes the certificate for a single student while preserving the award title.
    """
    pf = package_facts
    sch = pf["school"]
    student_name = " ".join(x for x in [pf["first_name"], pf.get("middle_name"), pf["last_name"]] if x)
    school_name = sch["name"]
    dob_line = f"\n- Date of Birth: {pf['date_of_birth']}"

    return f"""
Based on the layout and visual structure of the attached certificate template, generate a personalized certificate.

IMPORTANT: The award/activity title is: "{award_title}"

Replace the names in the template with ONLY this single recipient:
- Student Name: {student_name}
- School: {school_name}{dob_line}

Keep the same:
- Award/Activity Title: {award_title}
- Layout, fonts, spacing, borders, decorative elements
- Date format (update to a plausible date between 2020-2025)

Rules:
1. If template shows multiple names (e.g., "Elizabeth Ramirez, Mia Lewis, and Harper Taylor"), replace ALL of them with just "{student_name}"
2. Keep "Presented to" or similar phrasing before the name
3. Keep the award title "{award_title}" exactly as-is or very similar
4. Update any date to a realistic high school year date (e.g., May 15, 2023 or April 29th, 2024)
5. Maintain all visual elements, logos, signatures, seals, borders from the template
6. Output in same file format as template ({template_path.suffix.lower()})
7. Do not add watermarks or extra text beyond what's in the template

Generate a clean, professional certificate suitable for a high school student's portfolio.
"""


def determine_certificate_category(award_title: str, template_path: Path) -> str:
    """
    Determine if certificate is 'honor' or 'activity' based on title and path.
    """
    title_lower = award_title.lower()
    path_lower = str(template_path.parent).lower()
    
    # Check folder structure first
    if "honor" in path_lower:
        return "honor"
    if "activity" in path_lower or "extracurricular" in path_lower:
        return "activity"
    
    # Check title keywords
    honor_keywords = [
        "honor", "award", "achievement", "scholar", "academic", "excellence",
        "dean's list", "principal", "gpa", "merit", "distinction", "recognition"
    ]
    activity_keywords = [
        "team", "club", "competition", "volunteer", "service", "leadership",
        "captain", "president", "member", "participant", "workshop", "program"
    ]
    
    honor_score = sum(1 for keyword in honor_keywords if keyword in title_lower)
    activity_score = sum(1 for keyword in activity_keywords if keyword in title_lower)
    
    if activity_score > honor_score:
        return "activity"
    else:
        return "honor"  # Default to honor if unclear


def generate_certificates_by_category(
    client: genai.Client,
    cert_dir: Path,
    cert_title_cache: Dict[Path, str],
    num_honors: int,
    num_activities: int,
    image_size: str,
    sleep_seconds: float,
    logger: Logger,
    student_slug: str,
    school_slug: str,
    package_facts: Dict[str, Any],
) -> tuple[int, int]:
    """
    Generate specific numbers of honor and activity certificates for a single student using cached titles.
    Returns (num_honors_generated, num_activities_generated).
    """
    if not cert_title_cache:
        logger.log(f"[SKIP MULTI-CERT] No certificate templates available for {student_slug}@{school_slug}", to_console=False)
        return (0, 0)
    
    # Separate templates by category
    honor_templates = []
    activity_templates = []
    
    for template_path, title in cert_title_cache.items():
        category = determine_certificate_category(title, template_path)
        if category == "honor":
            honor_templates.append((template_path, title))
        else:
            activity_templates.append((template_path, title))
    
    logger.log(f"Available templates: {len(honor_templates)} honors, {len(activity_templates)} activities", to_console=False)
    
    honors_generated = 0
    activities_generated = 0
    
    # Generate honor certificates
    if num_honors > 0:
        if len(honor_templates) < num_honors:
            # If not enough templates, allow reuse
            honor_templates_to_use = random.choices(honor_templates, k=num_honors)
        else:
            # Pick unique templates
            honor_templates_to_use = random.sample(honor_templates, k=num_honors)
        
        for cert_idx, (cert_template, award_title) in enumerate(honor_templates_to_use, start=1):
            try:
                # Build prompt with extracted title
                cert_prompt = build_certificate_prompt_with_title(cert_template, award_title, package_facts)
                
                # Output filename
                output_file = cert_dir / f"certificate_{cert_idx}_honor{cert_template.suffix.lower()}"
                
                # Generate certificate
                generate_from_template(
                    client,
                    cert_prompt,
                    cert_template,
                    output_file,
                    few_shots=None,
                    image_size=image_size,
                    retries=1,
                )
                maybe_sleep(sleep_seconds)
                honors_generated += 1
                
            except Exception as cert_exc:
                if is_quota_exceeded(cert_exc):
                    logger.log(f"[STOP] Quota exceeded during HONOR {cert_idx} for {student_slug}@{school_slug}: {cert_exc}")
                    raise  # Re-raise to trigger stop_event in caller
                logger.log(f"[SKIP HONOR {cert_idx}] {student_slug}@{school_slug}: {cert_exc}", to_console=False)
                continue
    
    # Generate activity certificates
    if num_activities > 0:
        if len(activity_templates) < num_activities:
            # If not enough templates, allow reuse
            activity_templates_to_use = random.choices(activity_templates, k=num_activities)
        else:
            # Pick unique templates
            activity_templates_to_use = random.sample(activity_templates, k=num_activities)
        
        for cert_idx, (cert_template, award_title) in enumerate(activity_templates_to_use, start=1):
            try:
                # Build prompt with extracted title
                cert_prompt = build_certificate_prompt_with_title(cert_template, award_title, package_facts)
                
                # Output filename
                output_file = cert_dir / f"certificate_{cert_idx}_activity{cert_template.suffix.lower()}"
                
                # Generate certificate
                generate_from_template(
                    client,
                    cert_prompt,
                    cert_template,
                    output_file,
                    few_shots=None,
                    image_size=image_size,
                    retries=1,
                )
                maybe_sleep(sleep_seconds)
                activities_generated += 1
                
            except Exception as cert_exc:
                if is_quota_exceeded(cert_exc):
                    logger.log(f"[STOP] Quota exceeded during ACTIVITY {cert_idx} for {student_slug}@{school_slug}: {cert_exc}")
                    raise  # Re-raise to trigger stop_event in caller
                logger.log(f"[SKIP ACTIVITY {cert_idx}] {student_slug}@{school_slug}: {cert_exc}", to_console=False)
                continue
    
    return (honors_generated, activities_generated)

# ---------- End new multi-certificate generation ----------


def build_portrait_prompt(student: Dict[str, str], school: Dict[str, str]) -> str:
    student_name = f"{student.get('first_name', '').strip()} {student.get('last_name', '').strip()}"
    school_name = school.get("school_name", "").strip()
    return (
        "Generate a realistic yearbook-style portrait of a US high school student. "
        f"Student name (for styling only): {student_name}. School: {school_name}. "
        "Neat attire, neutral studio background, friendly expression. No text, no logos."
    )


def build_activity_prompt(package_facts: Dict[str, Any]) -> str:
    activities = [
        "debate competition",
        "community service volunteering",
        "robotics competition",
        "science fair presentation",
        "varsity sports game",
        "music performance",
    ]
    activity = random.choice(activities)
    pf = package_facts
    sch = pf["school"]
    student_name = " ".join(x for x in [pf["first_name"], pf.get("middle_name"), pf["last_name"]] if x)
    school_name = sch["name"]
    return (
        f"Generate a realistic photo of a US high school student participating in {activity}. "
        f"Student (for styling only): {student_name}, School: {school_name}. "
        "Natural lighting, candid event photo, no text or watermarks."
    )


def _image_bytes_to_pdf(image_bytes: bytes, out_path: Path) -> None:
    """Convert model-returned image bytes (PNG/JPEG) to a valid PDF file."""
    if not _PIL_AVAILABLE:
        raise RuntimeError("Pillow is required for PDF output. Install with: pip install Pillow")
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")
    img.save(str(out_path), "PDF", resolution=100)


def extract_image_part(response: types.GenerateContentResponse) -> types.Blob:
    for candidate in response.candidates or []:
        if candidate.content:
            for part in candidate.content.parts or []:
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    return part.inline_data
    debug_msg = "No image data returned from the model."
    if getattr(response, "prompt_feedback", None):
        debug_msg += f" prompt_feedback={response.prompt_feedback}"
    raise RuntimeError(debug_msg)


def build_image_generation_config(image_size: str) -> types.GenerateContentConfig:
    """
    Build IMAGE generation config with compatibility fallback.
    Some google-genai versions reject ImageConfig(image_size=...).
    """
    try:
        return types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(image_size=image_size),
        )
    except Exception:
        # Fallback for SDK versions that don't support image_size in ImageConfig.
        return types.GenerateContentConfig(response_modalities=["IMAGE"])


def generate_from_template(
    client: genai.Client,
    prompt: str,
    template_path: Path,
    outfile: Path,
    few_shots: List[types.Part] | None = None,
    image_size: str = "1024x1024",
    retries: int = 1,
) -> Path:
    mime_type = mimetypes.guess_type(template_path.name)[0] or "image/png"
    template_bytes = template_path.read_bytes()
    contents = (few_shots or []) + [
        types.Part.from_text(text=prompt),
        image_part_from_bytes(template_bytes, mime_type),
    ]
    config = build_image_generation_config(image_size)
    last_exc: Exception | None = None
    for _ in range(max(1, retries)):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=contents,
                config=config,
            )
            image_part = extract_image_part(response)
            if outfile.suffix.lower() == ".pdf":
                _image_bytes_to_pdf(image_part.data, outfile)
            else:
                outfile.write_bytes(image_part.data)
            return outfile
        except Exception as exc:  # pylint: disable=broad-except
            last_exc = exc
            continue
    if last_exc:
        raise last_exc
    return outfile


def generate_portrait(
    client: genai.Client,
    prompt: str,
    outfile: Path,
    image_size: str = "1024x1024",
) -> Path:
    contents = [types.Part.from_text(text=prompt)]
    config = build_image_generation_config(image_size)
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=contents,
        config=config,
    )
    image_part = extract_image_part(response)
    outfile.write_bytes(image_part.data)
    return outfile


def maybe_sleep(seconds: float) -> None:
    if seconds and seconds > 0:
        time.sleep(seconds)


def is_quota_exceeded(exc: Exception) -> bool:
    msg = str(exc)
    return "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower()


def is_retryable_api_throttle(exc: Exception) -> bool:
    """Transient limits (429, rate) — worth backing off and retrying."""
    if is_quota_exceeded(exc):
        return True
    msg = str(exc).lower()
    return "429" in msg or "resource exhausted" in msg or "rate limit" in msg or "try again later" in msg


def is_no_image_error(exc: Exception) -> bool:
    return "No image data returned" in str(exc)


class Logger:
    """Thread-safe logger that writes to both file and console."""

    def __init__(self, log_file: Path):
        self.log_file = log_file
        self.lock = threading.Lock()
        with self.lock:
            with log_file.open("w", encoding="utf-8") as f:
                f.write(f"=== Log started at {datetime.datetime.now().isoformat()} ===\n\n")

    def log(self, message: str, to_console: bool = True) -> None:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_line = f"[{timestamp}] {message}\n"
        with self.lock:
            try:
                with self.log_file.open("a", encoding="utf-8") as f:
                    f.write(log_line)
            except Exception as exc:
                print(f"ERROR: Failed to write to log file: {exc}", file=sys.stderr)
        if to_console:
            print(message)

    def write(self, message: str) -> None:
        self.log(message, to_console=True)


def create_log_file(output_root: Path) -> Path:
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    log_dir = output_root / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir / f"run_{timestamp}.log"


def cleanup_empty_dirs(root: Path) -> None:
    for dirpath, dirnames, filenames in os.walk(root, topdown=False):
        if not dirnames and not filenames:
            try:
                Path(dirpath).rmdir()
            except OSError:
                pass


def has_any_file(prefix: Path) -> bool:
    return any((prefix.with_suffix(ext)).exists() for ext in ALLOWED_IMAGE_EXTS)


def numbered_certificate_files(cert_dir: Path) -> List[Path]:
    """certificate_N.* with numeric N (e.g. certificate_01.png), sorted by N."""
    found: List[Tuple[int, Path]] = []
    if not cert_dir.exists():
        return []
    for p in cert_dir.iterdir():
        if not p.is_file() or p.suffix.lower() not in ALLOWED_IMAGE_EXTS:
            continue
        m = re.match(r"certificate_(\d+)$", p.stem, re.IGNORECASE)
        if m:
            found.append((int(m.group(1)), p))
    return [p for _, p in sorted(found, key=lambda t: t[0])]


def resolve_mapping_path(path: Optional[Path]) -> Optional[Path]:
    """Resolve --mapping to an existing file (cwd, script dir, or default)."""
    if path is None:
        return None
    candidates = [path.expanduser(), WORKSPACE_ROOT / path, Path.cwd() / path]
    if path.name == "common_app_mapping.json" or str(path) == "common_app_mapping.json":
        candidates.append(DEFAULT_MAPPING_PATH)
    for c in candidates:
        try:
            if c.is_file():
                return c.resolve()
        except OSError:
            continue
    return None


def student_has_document_artifacts(
    student_dir: Path,
    num_honors: int = 0,
    num_activities: int = 0,
    *,
    cert_min: int = 3,
) -> bool:
    """True when transcript, standard tests, and certificates exist (profile not required)."""
    if not has_any_file(student_dir / "transcript" / "transcript"):
        return False
    std_dir = student_dir / "standard_test"
    for test_name in ["act_score", "ap_score", "ib_score", "sat_score"]:
        if not has_any_file(std_dir / test_name):
            return False
    cert_dir = student_dir / "certificate"
    if not cert_dir.exists():
        return False
    if num_honors > 0 or num_activities > 0:
        honor_files = list(cert_dir.glob("certificate_*_honor*"))
        activity_files = list(cert_dir.glob("certificate_*_activity*"))
        if len(honor_files) < num_honors or len(activity_files) < num_activities:
            return False
    elif len(numbered_certificate_files(cert_dir)) < cert_min:
        return False
    return True


def _package_facts_path(student_dir: Path) -> Path:
    return student_dir / "package_facts.json"


def _remove_package_facts_file(student_dir: Path) -> None:
    """Drop cached generation facts after profile is written (keeps student output tidy)."""
    try:
        path = _package_facts_path(student_dir)
        if path.is_file():
            path.unlink()
    except OSError:
        pass


def gather_generated_document_paths(student_dir: Path) -> List[Path]:
    """
    Collect transcript, standardized-test, certificate, and optional activity outputs for vision-based profile extraction.
    Order: transcript folder, each standard_test subfolder, certificates, activity.
    """
    paths: List[Path] = []
    seen: set[str] = set()

    def add_unique(p: Path) -> None:
        if not p.is_file():
            return
        suf = p.suffix.lower()
        if suf not in ALLOWED_IMAGE_EXTS:
            return
        key = str(p.resolve())
        if key not in seen:
            seen.add(key)
            paths.append(p)

    transcript_dir = student_dir / "transcript"
    if transcript_dir.exists():
        for p in sorted(transcript_dir.iterdir()):
            add_unique(p)

    std_root = student_dir / "standard_test"
    if std_root.exists():
        for sub in sorted(std_root.iterdir()):
            if sub.is_dir():
                for p in sorted(sub.iterdir()):
                    add_unique(p)

    cert_dir = student_dir / "certificate"
    if cert_dir.exists():
        for p in sorted(cert_dir.iterdir()):
            add_unique(p)

    activity_dir = student_dir / "activity"
    if activity_dir.exists():
        for p in sorted(activity_dir.iterdir()):
            add_unique(p)

    return paths


def is_student_package_complete(
    student_dir: Path,
    require_profile: bool = False,
    num_honors: int = 0,
    num_activities: int = 0,
    *,
    require_activity: bool = False,
    cert_min: int = 3,
) -> bool:
    """
    Check if a student package is complete.
    If require_profile is True, also require profile/profile.pdf to exist.
    If num_honors > 0 or num_activities > 0, require the specified number of each certificate type.
    Otherwise require at least cert_min files matching certificate_<N>.*.
    If require_activity is True, require an activity/activity* image.
    """
    if not has_any_file(student_dir / "transcript" / "transcript"):
        return False
    std_dir = student_dir / "standard_test"
    for test_name in ["act_score", "ap_score", "ib_score", "sat_score"]:
        if not has_any_file(std_dir / test_name):
            return False
    
    # Certificate check
    cert_dir = student_dir / "certificate"
    if not cert_dir.exists():
        return False
    
    multi_cert_mode = (num_honors > 0 or num_activities > 0)
    if multi_cert_mode:
        # For multi-cert mode, check for specific number of honor and activity certificates
        honor_files = list(cert_dir.glob("certificate_*_honor*"))
        activity_files = list(cert_dir.glob("certificate_*_activity*"))
        
        if len(honor_files) < num_honors or len(activity_files) < num_activities:
            return False
    else:
        if len(numbered_certificate_files(cert_dir)) < cert_min:
            return False
    
    if require_activity and not has_any_file(student_dir / "activity" / "activity"):
        return False
    if require_profile and not (student_dir / "profile" / "profile.pdf").exists():
        return False
    return True


def cleanup_incomplete_packages(
    output_root: Path,
    logger: Optional[Logger] = None,
    require_profile: bool = False,
    num_honors: int = 0,
    num_activities: int = 0,
    *,
    require_activity: bool = False,
    cert_min: int = 3,
) -> tuple[int, int]:
    """Scan output directory and remove incomplete or empty student packages."""
    if not output_root.exists():
        return (0, 0)
    kept_count = 0
    removed_count = 0
    if logger:
        log = lambda msg: logger.log(msg, to_console=False)
    else:
        log = print
    for school_dir in sorted(p for p in output_root.iterdir() if p.is_dir()):
        for student_dir in sorted(p for p in school_dir.iterdir() if p.is_dir()):
            if is_student_package_complete(
                student_dir,
                require_profile=require_profile,
                num_honors=num_honors,
                num_activities=num_activities,
                require_activity=require_activity,
                cert_min=cert_min,
            ):
                if require_profile and (student_dir / "profile" / "profile.pdf").is_file():
                    _remove_package_facts_file(student_dir)
                kept_count += 1
            else:
                try:
                    shutil.rmtree(student_dir)
                    removed_count += 1
                    log(f"[CLEANUP] Removed incomplete package: {student_dir.relative_to(output_root)}")
                except Exception as exc:
                    log(f"[WARN] Failed to remove {student_dir}: {exc}")
        try:
            if not any(school_dir.iterdir()):
                school_dir.rmdir()
        except Exception:
            pass
    return (kept_count, removed_count)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate simulated student packages (with optional profile bundle).")
    parser.add_argument("-f", "--force", action="store_true", help="Remove existing output folder before generating.")
    parser.add_argument("--max", type=int, default=10, help="Maximum number of schools to generate (default: 100; <=0 means all).")
    parser.add_argument("--random", type=int, default=-1, help="Randomly pick N schools. If set, overrides --max/--number.")
    parser.add_argument("--number", type=int, default=-1, help="Pick first N schools in order. Ignored if --random is set.")
    parser.add_argument("--workers", type=int, default=1, help="Number of parallel workers for schools (default: 1).")
    parser.add_argument("--sleep", type=float, default=0.5, help="Seconds to sleep after each generation call (default: 0.5).")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUTPUT_ROOT, help="Output directory (default: ./output).")
    parser.add_argument("--api", dest="api_key", default=None, help="Gemini API key.")
    parser.add_argument("--model", dest="model_name", default=None, help="Gemini model name.")
    parser.add_argument(
        "--resolution",
        dest="resolution",
        default="1080p",
        choices=["360p", "720p", "1080p", "2k", "4k"],
        help="Image resolution for generated outputs (default: 1080p).",
    )
    # Profile bundle (from generate_profile_bundle)
    parser.add_argument(
        "--mapping",
        type=Path,
        default=None,
        help="Path to common_app_mapping.json. If set, generate a profile bundle (profile.pdf/json/txt) per student under student_dir/profile/.",
    )
    parser.add_argument(
        "--profile-full",
        action="store_true",
        default=True,
        help="Generate full profile (two-stage: Profile + all sections). Default: True.",
    )
    parser.add_argument(
        "--no-profile-full",
        action="store_false",
        dest="profile_full",
        help="Generate only Profile section (no full profile).",
    )
    parser.add_argument(
        "--profile-pdf-only",
        action="store_true",
        help="When generating profile, output only profile.pdf (no JSON/TXT).",
    )
    # Multi-certificate options
    parser.add_argument(
        "--num-honors",
        type=int,
        default=0,
        help="Number of honor certificates per student (e.g., academic awards, merit awards). Default: 0 (uses old single-cert method if both are 0).",
    )
    parser.add_argument(
        "--num-activities",
        type=int,
        default=0,
        help="Number of activity certificates per student (e.g., clubs, volunteer work, competitions). Default: 0 (uses old single-cert method if both are 0).",
    )
    parser.add_argument(
        "--cert-min",
        type=int,
        default=3,
        help="When not using --num-honors/--num-activities, each package gets a random count in [cert-min, cert-max]; this is the minimum (default: 3).",
    )
    parser.add_argument(
        "--cert-max",
        type=int,
        default=9,
        help="When not using --num-honors/--num-activities, maximum certificates per package (default: 9).",
    )
    parser.add_argument(
        "--activity-photo",
        action="store_true",
        help="Generate one activity image under activity/ (default: off).",
    )
    parser.add_argument(
        "--keep-incomplete",
        action="store_true",
        help="Keep incomplete student packages in output instead of deleting them during startup cleanup.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.cert_min < 1 or args.cert_max < args.cert_min:
        raise SystemExit("Invalid --cert-min/--cert-max: require 1 <= cert-min <= cert-max")
    random.seed()
    api_key = args.api_key or DEFAULT_API_KEY
    global MODEL_NAME  # noqa: PLW0603
    if args.model_name:
        MODEL_NAME = args.model_name

    resolution_map = {
        "360p": "640x360",
        "720p": "1280x720",
        "1080p": "1920x1080",
        "2k": "2560x1440",
        "4k": "3840x2160",
    }
    image_size = resolution_map.get(args.resolution, "1920x1080")

    output_root = args.out_dir
    if args.force and output_root.exists():
        shutil.rmtree(output_root)
    ensure_dir(output_root)

    log_file = create_log_file(output_root)
    logger = Logger(log_file)
    logger.log(f"Log file: {log_file}", to_console=True)
    logger.log(f"Output directory: {output_root}", to_console=True)
    logger.log(f"Model: {MODEL_NAME}", to_console=True)
    mapping_arg = getattr(args, "mapping", None)
    mapping_path = resolve_mapping_path(mapping_arg) if mapping_arg else None
    require_profile = mapping_path is not None
    if mapping_arg and not mapping_path:
        logger.log(
            f"Profile bundle: --mapping {mapping_arg} not found (also checked {DEFAULT_MAPPING_PATH}). "
            "Profile PDF/JSON will NOT be generated. Restore common_app_mapping.json or pass a valid path.",
            to_console=True,
        )
    elif mapping_path:
        logger.log(
            f"Profile bundle: mapping={mapping_path}, full={args.profile_full}, pdf_only={args.profile_pdf_only}",
            to_console=True,
        )
    else:
        logger.log("Profile bundle: disabled (no --mapping).", to_console=False)

    if not args.force and output_root.exists() and not args.keep_incomplete:
        logger.log("Checking existing packages for completeness...", to_console=True)
        kept, removed = cleanup_incomplete_packages(
            output_root,
            logger,
            require_profile=require_profile,
            num_honors=args.num_honors,
            num_activities=args.num_activities,
            require_activity=args.activity_photo,
            cert_min=args.cert_min,
        )
        if kept > 0 or removed > 0:
            logger.log(f"Kept {kept} complete packages, removed {removed} incomplete packages.", to_console=True)
    elif args.keep_incomplete:
        logger.log("Skipping cleanup of incomplete packages (--keep-incomplete set).", to_console=True)

    transcript_templates = pick_templates(TEMPLATE_TRANSCRIPT_ROOT)
    logger.log(f"Found {len(transcript_templates)} transcript templates.", to_console=False)

    # Initialize Gemini client
    client = genai.Client(api_key=api_key)
    
    # Preload certificate titles if using multi-cert mode
    cert_title_cache: Dict[Path, str] = {}
    multi_cert_mode = (args.num_honors > 0 or args.num_activities > 0)
    if multi_cert_mode:
        logger.log(f"Multi-certificate mode enabled: {args.num_honors} honors + {args.num_activities} activities per student", to_console=True)
        cert_title_cache = preload_certificate_titles(client, logger, sleep_seconds=args.sleep)

    stop_event = threading.Event()
    schools = load_high_schools(random_pick=args.random, number_pick=args.number)
    if args.max and args.max > 0 and args.random <= 0 and args.number <= 0:
        schools = schools[: args.max]
    students = load_students()
    logger.log(f"Processing {len(schools)} schools with {len(students)} students available.", to_console=True)
    if not multi_cert_mode:
        logger.log(
            f"Certificates per student: random int in [{args.cert_min}, {args.cert_max}] (no activity photo unless --activity-photo).",
            to_console=True,
        )

    def process_school(school: Dict[str, str], pbar: tqdm | None = None) -> None:
        if stop_event.is_set():
            return
        school_slug = sanitize_name(school.get("school_name", "school"))
        school_dir = ensure_dir(output_root / school_slug)
        student = random.choice(students)
        student_slug = sanitize_name(f"{student.get('first_name', 'student')}_{student.get('last_name', '')}")
        student_dir = school_dir / student_slug

        profile_only_resume = False
        if student_dir.exists():
            if is_student_package_complete(
                student_dir,
                require_profile=require_profile,
                num_honors=args.num_honors,
                num_activities=args.num_activities,
                require_activity=args.activity_photo,
                cert_min=args.cert_min,
            ):
                logger.log(f"[SKIP] Complete package already exists for {student_slug}@{school_slug}", to_console=False)
                return
            profile_only_resume = (
                require_profile
                and mapping_path is not None
                and student_has_document_artifacts(
                    student_dir,
                    num_honors=args.num_honors,
                    num_activities=args.num_activities,
                    cert_min=args.cert_min,
                )
                and not (student_dir / "profile" / "profile.pdf").exists()
            )
            if profile_only_resume:
                logger.log(
                    f"[RESUME] Documents exist without profile; generating profile only for {student_slug}@{school_slug}",
                    to_console=True,
                )
            else:
                try:
                    shutil.rmtree(student_dir)
                    logger.log(f"[REMOVE] Incomplete package removed for {student_slug}@{school_slug}", to_console=False)
                except Exception as exc:
                    logger.log(f"[WARN] Failed to remove incomplete package {student_slug}@{school_slug}: {exc}", to_console=False)

        student_dir = ensure_dir(student_dir)
        transcript_dir = ensure_dir(student_dir / "transcript")
        stdtest_dir = ensure_dir(student_dir / "standard_test")
        cert_dir = ensure_dir(student_dir / "certificate")
        activity_dir: Optional[Path] = None
        if args.activity_photo:
            activity_dir = ensure_dir(student_dir / "activity")
        if pbar:
            pbar.set_postfix(student=student_slug, refresh=False)

        # Single source of truth for prompts (transcript / tests / certs). Profile PDF is built after those images exist.
        facts_path = _package_facts_path(student_dir)
        persist_facts_cache = mapping_path is not None
        if profile_only_resume and facts_path.is_file():
            try:
                package_facts = json.loads(facts_path.read_text(encoding="utf-8"))
            except Exception:
                package_facts = build_package_facts(school, student)
        else:
            package_facts = build_package_facts(school, student)
            if persist_facts_cache and not profile_only_resume:
                try:
                    facts_path.write_text(
                        json.dumps(package_facts, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8",
                    )
                except Exception:
                    pass
        date_of_birth = package_facts["date_of_birth"]

        try:
            if not profile_only_resume:
                # Transcript
                try:
                    t_ok = False
                    last_error = None
                    for attempt in range(3):
                        template_path = random.choice(transcript_templates)
                        transcript_prompt = build_transcript_prompt(template_path, package_facts)
                        try:
                            generate_from_template(
                                client,
                                transcript_prompt,
                                template_path,
                                transcript_dir / f"transcript{template_path.suffix.lower()}",
                                few_shots=few_shot_examples_transcript(),
                                image_size=image_size,
                                retries=1,
                            )
                            maybe_sleep(args.sleep)
                            t_ok = True
                            break
                        except Exception as exc_trans_inner:
                            if is_quota_exceeded(exc_trans_inner):
                                logger.log(f"[STOP] Quota exceeded during TRANSCRIPT for {student_slug}@{school_slug}: {exc_trans_inner}")
                                stop_event.set()
                                return
                            last_error = exc_trans_inner
                            continue
                    if not t_ok:
                        error_msg = str(last_error) if last_error else "no successful render after 3 attempts"
                        logger.log(f"[SKIP TRANSCRIPT] {student_slug}@{school_slug}: {error_msg}", to_console=False)
                except Exception as exc_trans:
                    logger.log(f"[SKIP TRANSCRIPT] {student_slug}@{school_slug}: {exc_trans}", to_console=False)

                # Standard tests: ACT/AP/IB/SAT
                for test_name in ["ACT", "AP", "IB", "SAT"]:
                    test_root = TEMPLATE_STDTEST_ROOT / test_name
                    try:
                        ok = False
                        last_error = None
                        template_error = None
                        for attempt in range(3):
                            try:
                                test_template = pick_random_file(test_root)
                            except Exception as exc_no_tpl:
                                template_error = exc_no_tpl
                                logger.log(f"[SKIP {test_name}] {student_slug}@{school_slug}: {exc_no_tpl}", to_console=False)
                                break
                            test_prompt = build_stdtest_prompt(test_name, test_template, package_facts)
                            out_path = stdtest_dir / f"{test_name.lower()}_score{test_template.suffix.lower()}"
                            try:
                                generate_from_template(
                                    client,
                                    test_prompt,
                                    test_template,
                                    out_path,
                                    few_shots=None,
                                    image_size=image_size,
                                    retries=1,
                                )
                                maybe_sleep(args.sleep)
                                ok = True
                                break
                            except Exception as te:
                                if is_quota_exceeded(te):
                                    logger.log(f"[STOP] Quota exceeded during {test_name} for {student_slug}@{school_slug}: {te}")
                                    stop_event.set()
                                    return
                                last_error = te
                                continue
                        if not ok and not template_error:
                            error_msg = str(last_error) if last_error else "generation failed after 3 attempts"
                            logger.log(f"[SKIP {test_name}] {student_slug}@{school_slug}: {error_msg}", to_console=False)
                    except Exception as test_exc:
                        logger.log(f"[SKIP {test_name}] {student_slug}@{school_slug}: {test_exc}", to_console=False)

                # Certificates
                try:
                    if multi_cert_mode:
                        try:
                            honors_gen, activities_gen = generate_certificates_by_category(
                                client=client,
                                cert_dir=cert_dir,
                                cert_title_cache=cert_title_cache,
                                num_honors=args.num_honors,
                                num_activities=args.num_activities,
                                image_size=image_size,
                                sleep_seconds=args.sleep,
                                logger=logger,
                                student_slug=student_slug,
                                school_slug=school_slug,
                                package_facts=package_facts,
                            )
                            total_gen = honors_gen + activities_gen
                            total_expected = args.num_honors + args.num_activities
                            if total_gen < total_expected:
                                logger.log(f"[PARTIAL CERT] Generated {honors_gen}/{args.num_honors} honors + {activities_gen}/{args.num_activities} activities for {student_slug}@{school_slug}", to_console=False)
                        except Exception as multi_cert_exc:
                            if is_quota_exceeded(multi_cert_exc):
                                logger.log(f"[STOP] Quota exceeded during multi-cert for {student_slug}@{school_slug}: {multi_cert_exc}")
                                stop_event.set()
                                return
                            logger.log(f"[SKIP MULTI-CERT] {student_slug}@{school_slug}: {multi_cert_exc}", to_console=False)
                    else:
                        n_certs = random.randint(args.cert_min, args.cert_max)
                        try:
                            pool = pick_templates(TEMPLATE_CERT_ROOT)
                        except Exception as exc_no_tpl:
                            logger.log(f"[SKIP CERT] {student_slug}@{school_slug}: {exc_no_tpl}", to_console=False)
                        else:
                            random.shuffle(pool)
                            ti = 0
                            for cert_idx in range(1, n_certs + 1):
                                c_ok = False
                                last_error: Exception | None = None
                                for attempt in range(3):
                                    cert_template = pool[ti % len(pool)]
                                    ti += 1
                                    cert_prompt = build_certificate_prompt(cert_template, package_facts)
                                    out_path = cert_dir / f"certificate_{cert_idx:02d}{cert_template.suffix.lower()}"
                                    try:
                                        generate_from_template(
                                            client,
                                            cert_prompt,
                                            cert_template,
                                            out_path,
                                            few_shots=None,
                                            image_size=image_size,
                                            retries=1,
                                        )
                                        maybe_sleep(args.sleep)
                                        c_ok = True
                                        break
                                    except Exception as cert_exc_inner:
                                        if is_quota_exceeded(cert_exc_inner):
                                            logger.log(f"[STOP] Quota exceeded during CERT {cert_idx} for {student_slug}@{school_slug}: {cert_exc_inner}")
                                            stop_event.set()
                                            return
                                        last_error = cert_exc_inner
                                        continue
                                if not c_ok:
                                    error_msg = str(last_error) if last_error else "generation failed after 3 attempts"
                                    logger.log(f"[SKIP CERT {cert_idx}/{n_certs}] {student_slug}@{school_slug}: {error_msg}", to_console=False)
                except Exception as cert_exc:
                    logger.log(f"[SKIP CERT] {student_slug}@{school_slug}: {cert_exc}", to_console=False)

                # Activity photo (optional)
                if args.activity_photo and activity_dir is not None:
                    try:
                        activity_prompt = build_activity_prompt(package_facts)
                        generate_portrait(
                            client,
                            activity_prompt,
                            activity_dir / "activity.jpg",
                            image_size=image_size,
                        )
                        maybe_sleep(args.sleep)
                    except Exception as act_exc:
                        if is_quota_exceeded(act_exc):
                            logger.log(f"[STOP] Quota exceeded during ACTIVITY for {student_slug}@{school_slug}: {act_exc}")
                            stop_event.set()
                            return
                        logger.log(f"[SKIP ACTIVITY] {student_slug}@{school_slug}: {act_exc}", to_console=False)

            # Profile: vision reads generated documents; optional text fallback if vision fails or nothing to read
            if mapping_path:
                profile_dir = ensure_dir(student_dir / "profile")
                doc_paths = gather_generated_document_paths(student_dir)
                fallback_ok = os.environ.get("PROFILE_FALLBACK_TEXT_ON_FAILURE", "1").lower() not in ("0", "false", "no")
                vision_ok = False
                profile_written = False
                vision_err: Optional[Exception] = None
                if doc_paths:
                    try:
                        _, _clean = generate_profile_from_document_images(
                            client,
                            mapping_path,
                            profile_dir,
                            doc_paths,
                            first_name=student.get("first_name", "").strip(),
                            last_name=student.get("last_name", "").strip(),
                            full=args.profile_full,
                            pdf_only=args.profile_pdf_only,
                            package_facts=package_facts,
                        )
                        maybe_sleep(args.sleep)
                        vision_ok = True
                        profile_written = (profile_dir / "profile.pdf").is_file()
                        logger.log(
                            f"[PROFILE] Vision profile from {len(doc_paths)} document(s) for {student_slug}@{school_slug}",
                            to_console=True,
                        )
                    except Exception as prof_exc:
                        vision_err = prof_exc
                        logger.log(
                            f"[PROFILE] Vision extraction failed for {student_slug}@{school_slug}: {prof_exc}",
                            to_console=True,
                        )
                else:
                    logger.log(
                        f"[PROFILE] No generated documents found under {student_dir.name} for vision; "
                        f"will try text fallback if enabled.",
                        to_console=False,
                    )

                if not vision_ok and fallback_ok:
                    try:
                        generate_one_profile(
                            client,
                            mapping_path,
                            profile_dir,
                            first_name=student.get("first_name", "").strip(),
                            last_name=student.get("last_name", "").strip(),
                            full=args.profile_full,
                            pdf_only=args.profile_pdf_only,
                            package_facts=package_facts,
                        )
                        maybe_sleep(args.sleep)
                        profile_written = (profile_dir / "profile.pdf").is_file()
                        suffix = f" (after vision error: {vision_err})" if vision_err else ""
                        logger.log(
                            f"[PROFILE] Text fallback profile written for {student_slug}@{school_slug}{suffix}",
                            to_console=True,
                        )
                    except Exception as fb_exc:
                        logger.log(f"[SKIP PROFILE] {student_slug}@{school_slug}: fallback failed: {fb_exc}", to_console=True)
                elif not vision_ok:
                    logger.log(
                        f"[SKIP PROFILE] {student_slug}@{school_slug}: vision failed and PROFILE_FALLBACK_TEXT_ON_FAILURE is off",
                        to_console=True,
                    )

                if profile_written:
                    _remove_package_facts_file(student_dir)
            elif mapping_arg and not mapping_path:
                logger.log(
                    f"[SKIP PROFILE] {student_slug}@{school_slug}: mapping file not found",
                    to_console=True,
                )

        except Exception as exc:
            logger.log(f"Failed for {student_slug} at {school_slug}: {exc}", to_console=False)
            if is_quota_exceeded(exc):
                stop_event.set()
                return

    total_schools = len(schools)
    with tqdm(total=total_schools, desc="Schools", unit="school") as pbar:
        pbar.write = logger.write
        if args.workers <= 1:
            for school in schools:
                if stop_event.is_set():
                    break
                process_school(school, pbar)
                pbar.update(1)
        else:
            with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
                futures = [executor.submit(process_school, school, pbar) for school in schools]
                for fut in concurrent.futures.as_completed(futures):
                    pbar.update(1)
                    if stop_event.is_set():
                        break

    cleanup_empty_dirs(output_root)
    logger.log(f"=== Run completed at {datetime.datetime.now().isoformat()} ===", to_console=True)
    logger.log(f"Log file saved to: {log_file}", to_console=True)


if __name__ == "__main__":
    main()
