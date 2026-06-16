from __future__ import annotations

import os

import pytest
from dotenv import load_dotenv  # type: ignore

from tools.instagrapi_tool import IGCommentData
from tools.llm_client import LLMClient

load_dotenv()


class _FakeInstagrapiPreview:
    """
    No-network, no-post backend used only for preview tests.
    It returns deterministic post/comment data and fake write IDs.
    """

    def get_post_by_url(self, url: str):
        media_id = "preview_media_2" if "PREVIEW124" in url else "preview_media_1"
        return (
            media_id,
            url,
            "I am stressed about college applications and deadlines. #collegeapps #commonapp",
        )

    def get_latest_post(self, username: str):
        return (
            "preview_media_latest",
            "https://www.instagram.com/p/PREVIEW123/",
            "Latest post caption about school applications.",
        )

    def get_comments(self, media_id: str, limit: int = 50):
        return [
            IGCommentData(
                comment_id="preview_comment_1",
                text="Any tips for staying organized?",
                username="student_one",
                media_id=media_id,
            ),
            IGCommentData(
                comment_id="preview_comment_2",
                text="Did you use Common App for all schools?",
                username="student_two",
                media_id=media_id,
            ),
        ]

    def publish_media_post(self, media_path_or_url: str, caption: str):
        print("[SEND] publish_media_post")
        print(f"[SEND] media={media_path_or_url}")
        return "preview_post_id"

    def send_dm(self, username: str, text: str):
        print("[SEND] send_dm")
        print(f"[SEND] to=@{username}")
        return "preview_thread_id"

    def post_comment(self, media_id: str, text: str):
        print("[SEND] post_comment")
        print(f"[SEND] media_id={media_id}")
        return "preview_comment_id"

    def reply_to_comment(self, media_id: str, comment_id: str, text: str):
        print("[SEND] reply_to_comment")
        print(f"[SEND] media_id={media_id} comment_id={comment_id}")
        return "preview_reply_id"


def _print_block(label: str, text: str) -> None:
    print(f"\n{label}")
    print("-" * len(label))
    print(text)


def test_preview_all_functions_manual_and_llm(tmp_memory_dir):
    """
    Prints content for each function in both modes.
    This test never posts to Instagram because it uses a fake backend.

    Requirements:
      - RUN_LLM_PREVIEW_TEST=1
      - OPENAI_API_KEY set
    """
    if os.getenv("RUN_LLM_PREVIEW_TEST") != "1":
        print("[SKIP] RUN_LLM_PREVIEW_TEST is not set to 1.")
        print("[SKIP] Use: RUN_LLM_PREVIEW_TEST=1 OPENAI_API_KEY=your_key python -m pytest -q -s tests/test_content_preview.py")
        pytest.skip("Set RUN_LLM_PREVIEW_TEST=1 to run real OpenAI preview test.")

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not openai_key:
        print("[SKIP] OPENAI_API_KEY is not set (env and .env checked).")
        pytest.skip("OPENAI_API_KEY is not set")
    if openai_key == "sk-...":
        print("[SKIP] OPENAI_API_KEY is still placeholder value 'sk-...'.")
        pytest.skip("OPENAI_API_KEY placeholder value")

    from agents.comment_agent import CommentAgent
    from agents.dm_agent import DMAgent
    from agents.post_agent import PostAgent
    from agents.reply_agent import ReplyAgent

    llm = LLMClient(provider="openai")
    ig = _FakeInstagrapiPreview()

    post_agent = PostAgent(llm=llm, instagrapi=ig, memory=tmp_memory_dir, max_daily_posts=50)
    dm_agent = DMAgent(llm=llm, instagrapi=ig, memory=tmp_memory_dir)
    comment_agent = CommentAgent(llm=llm, instagrapi=ig, memory=tmp_memory_dir, max_daily_comments=50)
    reply_agent = ReplyAgent(llm=llm, instagrapi=ig, memory=tmp_memory_dir, max_replies_per_run=5)

    post_manual_text = post_agent.post_manual(
        media_path_or_url="https://example.com/preview.jpg",
        caption="Manual post: sharing what helped me manage deadlines.",
    )
    _print_block("POST MANUAL CONTENT", post_manual_text)

    post_llm_text = post_agent.post_llm(
        media_path_or_url="https://example.com/preview.jpg",
        post_format="tips",
        extra_context="Focus on practical workflow and calm tone.",
    )
    _print_block("POST LLM CONTENT", post_llm_text)

    dm_manual_text = dm_agent.dm_manual(
        username="target_student",
        text="Manual DM: if you want, I can share how I built my college list.",
    )
    _print_block("DM MANUAL CONTENT", dm_manual_text)

    dm_llm_text = dm_agent.dm_llm(
        username="target_student",
        materials="Student is worried about timeline and school shortlist.",
        extra_context="Keep it warm and concise.",
    )
    _print_block("DM LLM CONTENT", dm_llm_text)

    comment_manual_text = comment_agent.comment_manual(
        post_url="https://www.instagram.com/p/PREVIEW123/",
        text="Manual comment: I felt the same way; a deadline tracker helped me a lot.",
    )
    _print_block("COMMENT MANUAL CONTENT", comment_manual_text)

    comment_llm_text = comment_agent.comment_llm(
        post_url="https://www.instagram.com/p/PREVIEW124/",
        extra_context="Reply like a peer, practical and specific.",
    )
    _print_block("COMMENT LLM CONTENT", comment_llm_text)

    reply_manual_count = reply_agent.reply_manual(
        username="owner_account",
        post_url="https://www.instagram.com/p/PREVIEW123/",
        manual_replies={
            "preview_comment_1": "Manual reply: I used a weekly checklist and calendar blocks.",
            "preview_comment_2": "Manual reply: yes, mostly Common App, plus a few direct portals.",
        },
    )
    print(f"\nREPLY MANUAL COUNT: {reply_manual_count}")

    # Reset reply dedup IDs so the LLM reply path can run on same fake comments.
    state = tmp_memory_dir.load_state()
    state["replied_comment_ids"] = []
    tmp_memory_dir.save_state(state)

    reply_llm_count = reply_agent.reply_llm(
        username="owner_account",
        post_url="https://www.instagram.com/p/PREVIEW123/",
        extra_context="Keep replies short and actionable.",
    )
    print(f"REPLY LLM COUNT: {reply_llm_count}")

    assert post_manual_text
    assert post_llm_text
    assert dm_manual_text
    assert dm_llm_text
    assert comment_manual_text
    assert comment_llm_text
    assert reply_manual_count >= 1
    assert reply_llm_count >= 1
