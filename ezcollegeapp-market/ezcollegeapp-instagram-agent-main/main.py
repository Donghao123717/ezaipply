"""
main.py - CLI entry-point for instagrapi-only Instagram automation.

Examples:
    python main.py run-job --job-file job.yaml --mode manual
    python main.py post-manual --media ./assets/post.jpg --caption "Final caption"
    python main.py post-llm --media ./assets/post.jpg --format tips --context "financial aid"
    python main.py dm-manual --username someuser --text "Hey!"
    python main.py dm-llm --username someuser --materials "Student asked about deadlines"
    python main.py comment-manual --post-url https://www.instagram.com/p/ABC123/ --text "Nice post"
    python main.py comment-llm --post-url https://www.instagram.com/p/ABC123/ --context "focus on school list"
    python main.py reply-manual --username someuser --post-url https://www.instagram.com/p/ABC123/ --replies-file replies.yaml
    python main.py reply-llm --username someuser --post-url https://www.instagram.com/p/ABC123/
    python main.py follow --accounts-file accounts_to_follow.yaml
"""
from __future__ import annotations

import argparse
import logging
from pathlib import Path

import yaml  # type: ignore
from dotenv import load_dotenv  # type: ignore

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


def _orch():
    from agents.orchestrator import Orchestrator

    return Orchestrator()


def cmd_run_job(args: argparse.Namespace) -> None:
    summary = _orch().run_job(job_path=args.job_file, mode_override=args.mode or "")
    print("\nJob complete.")
    print(yaml.safe_dump(summary, sort_keys=False))


def cmd_post_manual(args: argparse.Namespace) -> None:
    caption = _orch().post_manual(media_path_or_url=args.media, caption=args.caption)
    print(f"\nPosted with caption:\n\n{caption}")


def cmd_post_llm(args: argparse.Namespace) -> None:
    caption = _orch().post_llm(
        media_path_or_url=args.media,
        post_format=args.format,
        extra_context=args.context,
    )
    print(f"\nPosted with generated caption:\n\n{caption}")


def cmd_dm_manual(args: argparse.Namespace) -> None:
    text = _orch().dm_manual(username=args.username, text=args.text)
    print(f"\nDM sent to @{args.username}:\n\n{text}")


def cmd_dm_llm(args: argparse.Namespace) -> None:
    text = _orch().dm_llm(
        username=args.username,
        materials=args.materials,
        extra_context=args.context,
    )
    print(f"\nGenerated DM sent to @{args.username}:\n\n{text}")


def cmd_comment_manual(args: argparse.Namespace) -> None:
    text = _orch().comment_manual(post_url=args.post_url, text=args.text)
    print(f"\nComment posted:\n\n{text}")


def cmd_comment_llm(args: argparse.Namespace) -> None:
    text = _orch().comment_llm(post_url=args.post_url, extra_context=args.context)
    print(f"\nGenerated comment posted:\n\n{text}")


def cmd_reply_manual(args: argparse.Namespace) -> None:
    replies = _load_manual_replies(args.replies_file)
    count = _orch().reply_manual(
        username=args.username,
        post_url=args.post_url,
        manual_replies=replies,
    )
    print(f"\nDone. Replied to {count} comment(s).")


def cmd_reply_llm(args: argparse.Namespace) -> None:
    count = _orch().reply_llm(
        username=args.username,
        post_url=args.post_url,
        extra_context=args.context,
    )
    print(f"\nDone. Replied to {count} comment(s).")


def cmd_follow(args: argparse.Namespace) -> None:
    accounts = _load_accounts_file(args.accounts_file)
    count = _orch().follow_batch(accounts)
    print(f"\nDone. Followed {count} account(s).")


def _load_accounts_file(path: str) -> list[str]:
    file_path = Path(path).expanduser().resolve()
    with file_path.open() as f:
        data = yaml.safe_load(f) or {}
    return [str(u) for u in data.get("accounts", [])]


def _load_manual_replies(path: str) -> dict[str, str]:
    file_path = Path(path).expanduser().resolve()
    with file_path.open() as f:
        data = yaml.safe_load(f) or {}
    items = data.get("manual_replies", [])
    return {item["comment_id"]: item["text"] for item in items}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="EZCollegeApp Instagram Agent (instagrapi only)")
    sub = parser.add_subparsers(dest="command", required=True)

    run_job = sub.add_parser("run-job", help="Run all actions from a job YAML file")
    run_job.add_argument("--job-file", required=True, help="Path to job YAML")
    run_job.add_argument("--mode", choices=["manual", "llm"], default="", help="Optional mode override")

    post_manual = sub.add_parser("post-manual", help="Create post from manual caption")
    post_manual.add_argument("--media", required=True, help="Image/video file path or URL")
    post_manual.add_argument("--caption", required=True, help="Final caption text")

    post_llm = sub.add_parser("post-llm", help="Create post with LLM-generated caption")
    post_llm.add_argument("--media", required=True, help="Image/video file path or URL")
    post_llm.add_argument("--format", choices=["story", "tips", "question"], default="story")
    post_llm.add_argument("--context", default="", help="Optional generation context")

    dm_manual = sub.add_parser("dm-manual", help="Send manual DM")
    dm_manual.add_argument("--username", required=True)
    dm_manual.add_argument("--text", required=True)

    dm_llm = sub.add_parser("dm-llm", help="Send LLM-generated DM")
    dm_llm.add_argument("--username", required=True)
    dm_llm.add_argument("--materials", required=True, help="Materials for generation")
    dm_llm.add_argument("--context", default="")

    comment_manual = sub.add_parser("comment-manual", help="Post manual comment to a post URL")
    comment_manual.add_argument("--post-url", required=True)
    comment_manual.add_argument("--text", required=True)

    comment_llm = sub.add_parser("comment-llm", help="Post LLM-generated comment to a post URL")
    comment_llm.add_argument("--post-url", required=True)
    comment_llm.add_argument("--context", default="")

    reply_manual = sub.add_parser("reply-manual", help="Reply with manual per-comment text")
    reply_manual.add_argument("--username", required=True)
    reply_manual.add_argument("--post-url", default="")
    reply_manual.add_argument("--replies-file", required=True, help="YAML with manual_replies list")

    reply_llm = sub.add_parser("reply-llm", help="Reply with LLM-generated text")
    reply_llm.add_argument("--username", required=True)
    reply_llm.add_argument("--post-url", default="")
    reply_llm.add_argument("--context", default="")

    follow = sub.add_parser("follow", help="Follow accounts from a YAML file")
    follow.add_argument(
        "--accounts-file",
        required=True,
        help="YAML file with an 'accounts' list of usernames to follow",
    )

    return parser


if __name__ == "__main__":
    parser = build_parser()
    args = parser.parse_args()

    dispatch = {
        "run-job": cmd_run_job,
        "post-manual": cmd_post_manual,
        "post-llm": cmd_post_llm,
        "dm-manual": cmd_dm_manual,
        "dm-llm": cmd_dm_llm,
        "comment-manual": cmd_comment_manual,
        "comment-llm": cmd_comment_llm,
        "reply-manual": cmd_reply_manual,
        "reply-llm": cmd_reply_llm,
        "follow": cmd_follow,
    }
    dispatch[args.command](args)
