#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import glob
import time
from typing import Any, Dict, Optional, List

from openai import OpenAI
from jsonschema import validate, ValidationError

IN_DIR = "/Users/yiweili/Documents/EZcommonapp/college_results_top_alltime"
OUT_DIR = "/Users/yiweili/Documents/EZcommonapp/college_results_top_alltime_clean"

MODEL = "gpt-5.2"
REASONING_EFFORT = "low"
REQUEST_TIMEOUT_S = 90
MAX_RETRIES = 3
SLEEP_BETWEEN_FILES_S = 0.15

# 合并 selftext + replies 后，最多送这么多字符给模型
MAX_COMBINED_CHARS = 120000

api_key = "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"
if not api_key:
    raise RuntimeError("Missing OPENAI_API_KEY. Run: export OPENAI_API_KEY='sk-...'")

# 小提示：避免把 anthropic key 塞进来
if api_key.startswith("sk-ant-"):
    raise RuntimeError("OPENAI_API_KEY looks like an Anthropic key (sk-ant-...). Please set an OpenAI key (sk-...).")

client = OpenAI(api_key=api_key)


# ---------- 输出 schema（保持跟你之前一致） ----------
OUTPUT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "is_application_post": {"type": "boolean"},
        "reason": {"type": "string"},
        "result": {
            "type": ["object", "null"],
            "additionalProperties": False,
            "properties": {
                "CURRENT_PROFILE_GROUPED_JSON": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "ACADEMIC_RECORDS": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "gpa_unweighted": {"type": ["number", "null"]},
                                "sat_total": {"type": ["integer", "null"]},
                                "act_composite": {"type": ["integer", "null"]},
                                "class_rank_percentile": {"type": ["number", "null"]},
                                "ap_ib_honors_count": {"type": ["integer", "null"]},
                            },
                            "required": [
                                "gpa_unweighted",
                                "sat_total",
                                "act_composite",
                                "class_rank_percentile",
                                "ap_ib_honors_count",
                            ],
                        },
                        "ACTIVITIES_LEADERSHIP": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "activities": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "additionalProperties": False,
                                        "properties": {
                                            "name": {"type": "string"},
                                            "role": {"type": "string"},
                                            "description": {"type": "string"},
                                        },
                                        "required": ["name", "role", "description"],
                                    },
                                }
                            },
                            "required": ["activities"],
                        },
                        "AWARDS_VALIDATION": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "awards": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "additionalProperties": False,
                                        "properties": {
                                            "name": {"type": "string"},
                                            "year": {"type": ["integer", "null"]},
                                            "issuer": {"type": "string"},
                                        },
                                        "required": ["name", "year", "issuer"],
                                    },
                                }
                            },
                            "required": ["awards"],
                        },
                        "SERVICE_CONTEXT": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "community_service_hours": {"type": ["integer", "null"]},
                                "first_gen": {"type": ["boolean", "null"]},
                                "service_summary": {"type": "string"},
                            },
                            "required": ["community_service_hours", "first_gen", "service_summary"],
                        },
                        "PROFILE_META": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "student_id": {"type": "string"},
                                "major": {"type": "string"},
                            },
                            "required": ["student_id", "major"],
                        },
                        "ESSAY_SCORE": {"type": ["number", "null"]},
                    },
                    "required": [
                        "ACADEMIC_RECORDS",
                        "ACTIVITIES_LEADERSHIP",
                        "AWARDS_VALIDATION",
                        "SERVICE_CONTEXT",
                        "PROFILE_META",
                        "ESSAY_SCORE",
                    ],
                }
            },
            "required": ["CURRENT_PROFILE_GROUPED_JSON"],
        },
    },
    "required": ["is_application_post", "reason", "result"],
}


SYSTEM_PROMPT = """You are a strict information extraction engine.

You will receive combined text from:
- the post selftext
- and comment replies (bodies)

Task:
1) Decide whether the combined text contains a college admissions applicant 'results/profile' post
   (demographics + academics + tests + activities + awards + decisions).
2) If YES, extract ONLY what is explicitly stated into the target JSON schema.
3) If NO, output is_application_post=false and result=null.

Rules:
- Use ONLY info present in the text. Do NOT guess.
- Missing/unclear numeric fields => null.
- activities/awards missing => empty array [].
- PROFILE_META.student_id => "" (leave empty unless text includes one).
- PROFILE_META.major => intended major(s) if stated else "".
- You MUST output ALL top-level keys: is_application_post, reason, result.
- Return ONLY valid JSON (no markdown, no extra commentary)."""


def safe_read_json(path: str) -> Optional[Dict[str, Any]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"  !! Failed to read JSON: {path} ({e})")
        return None


def _strip_code_fences(s: str) -> str:
    s = (s or "").strip()
    if s.startswith("```"):
        s = s.strip("`").strip()
        if s.lower().startswith("json"):
            s = s[4:].strip()
    return s


def get_selftext(doc: Dict[str, Any]) -> str:
    post = doc.get("post", {}) if isinstance(doc, dict) else {}
    st = post.get("selftext", "")
    return "" if st is None else str(st)


def get_replies_bodies(doc: Dict[str, Any]) -> List[str]:
    """
    尝试从 replies_to_comment 里取出每条 reply 的 body。
    兼容几种常见结构：
    - replies_to_comment: [{"body": "..."}]
    - replies_to_comment: {"data": [{"body": "..."}]}
    - replies_to_comment: [{"comment": {"body": "..."}}]  (少见，做容错)
    """
    out: List[str] = []
    rtc = doc.get("replies_to_comment", None)
    if rtc is None:
        return out

    items = []
    if isinstance(rtc, list):
        items = rtc
    elif isinstance(rtc, dict):
        # e.g. {"data": [...]}
        if isinstance(rtc.get("data"), list):
            items = rtc["data"]
        else:
            # unknown dict format
            items = []
    else:
        return out

    for it in items:
        if not isinstance(it, dict):
            continue
        if "body" in it and it["body"]:
            out.append(str(it["body"]))
            continue
        # fallback shapes
        c = it.get("comment")
        if isinstance(c, dict) and c.get("body"):
            out.append(str(c["body"]))

    return out


def build_combined_text(doc: Dict[str, Any]) -> str:
    selftext = get_selftext(doc).strip()
    replies = [r.strip() for r in get_replies_bodies(doc) if isinstance(r, str) and r.strip()]

    parts = []
    if selftext:
        parts.append("POST_SELFTEXT:\n" + selftext)
    if replies:
        # 把回复拼起来，增加结构提示
        joined = "\n\n---\n\n".join(replies)
        parts.append("REPLIES_TO_COMMENT_BODIES:\n" + joined)

    combined = "\n\n====================\n\n".join(parts).strip()
    if len(combined) > MAX_COMBINED_CHARS:
        combined = combined[:MAX_COMBINED_CHARS]
    return combined


def normalize_and_validate(data: Dict[str, Any]) -> Dict[str, Any]:
    # 补顶层缺失字段，避免你之前遇到的 'reason' 缺失直接失败
    if "is_application_post" not in data:
        data["is_application_post"] = False
    if "reason" not in data:
        data["reason"] = ""
    if "result" not in data:
        data["result"] = None

    # 如果 result 结构不对，直接置空
    if data["result"] is not None and (
        not isinstance(data["result"], dict) or "CURRENT_PROFILE_GROUPED_JSON" not in data["result"]
    ):
        data["result"] = None

    validate(instance=data, schema=OUTPUT_SCHEMA)
    return data


def call_gpt_extract(combined_text: str) -> Dict[str, Any]:
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = client.responses.create(
                model=MODEL,
                reasoning={"effort": REASONING_EFFORT},
                input=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": combined_text},
                ],
                timeout=REQUEST_TIMEOUT_S,
            )

            out_text = _strip_code_fences(resp.output_text)
            data = json.loads(out_text)
            return normalize_and_validate(data)

        except (json.JSONDecodeError, ValidationError) as e:
            last_err = e
            backoff = 2 * attempt
            print(f"  !! Output not valid JSON/schema attempt {attempt}/{MAX_RETRIES}: {e} (sleep {backoff}s)")
            time.sleep(backoff)

        except Exception as e:
            last_err = e
            backoff = 2 * attempt
            print(f"  !! API error attempt {attempt}/{MAX_RETRIES}: {e} (sleep {backoff}s)")
            time.sleep(backoff)

    raise last_err


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    paths = sorted(glob.glob(os.path.join(IN_DIR, "*.json")))
    print(f"Found {len(paths)} json files in {IN_DIR}")

    kept = skipped = failed = 0

    for idx, path in enumerate(paths, 1):
        fname = os.path.basename(path)
        print(f"\n[{idx}/{len(paths)}] Processing: {fname}")

        doc = safe_read_json(path)
        if not doc:
            failed += 1
            continue

        combined_text = build_combined_text(doc)
        if not combined_text:
            print("  -> skipped (empty selftext and no replies_to_comment bodies)")
            skipped += 1
            continue

        print(f"  combined chars: {len(combined_text)}")
        print("  -> calling API...")

        try:
            result = call_gpt_extract(combined_text)
            print("  -> API returned.")
        except Exception as e:
            print(f"  !! failed after retries: {e}")
            failed += 1
            continue

        if result.get("is_application_post") and result.get("result") is not None:
            out_path = os.path.join(OUT_DIR, fname)
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(result["result"], f, ensure_ascii=False, indent=2)
            kept += 1
            print(f"  -> saved: {out_path}")
        else:
            skipped += 1
            print(f"  -> skipped: {result.get('reason', '(no reason)')}")

        time.sleep(SLEEP_BETWEEN_FILES_S)

    print("\nDone.")
    print(f"kept={kept}, skipped={skipped}, failed={failed}, total={len(paths)}")


if __name__ == "__main__":
    main()