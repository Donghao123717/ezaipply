"""
Comment Agent: posts a comment on a Facebook post URL, with a self-critique pass.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from tools.playwright_tool import PlaywrightTool
from tools.llm_client import LLMClient
from tools.memory_tool import MemoryTool
from tools.prompt_loader import load_md, load_yaml_prompt, render

logger = logging.getLogger(__name__)

_SELF_CRITIQUE_SYSTEM = """
You are a Facebook content quality reviewer. Given a draft comment on a Facebook post,
decide whether it is good enough to publish and return ONLY a JSON object:
{
  "approved": true or false,
  "feedback": "one-sentence reason if rejected"
}

Approve if:
- The comment genuinely engages with the post's topic with real, useful advice
- The tone is warm, casual, and peer-like — as if written by a fellow student
- Any mention of EZCollegeApp is brief, comes AFTER real advice, and reads like personal experience

Reject ONLY if:
- The comment is mostly promotional with little genuine engagement
- The comment opens with a product mention
- The comment makes false claims or looks like a bot reply
"""

_SELF_CRITIQUE_USER = """
Original post caption: {post_caption}
Draft comment:
{comment}

Approve or reject?
"""


class CommentAgent:
    def __init__(
        self,
        llm: LLMClient,
        playwright: PlaywrightTool,
        memory: MemoryTool,
        max_daily_comments: int = 15,
    ):
        self.llm = llm
        self.playwright = playwright
        self.memory = memory
        self.max_daily_comments = max_daily_comments
        self._prompts = load_yaml_prompt("comment_prompt.yaml")
        self._product_context = load_md("product_context.md")
        self._brand_voice = load_md("brand_voice.md")

    def comment_manual(self, post_url: str, text: str) -> str:
        if not text.strip():
            raise ValueError("text is required for comment_manual")

        if self.memory.daily_comment_count() >= self.max_daily_comments:
            raise RuntimeError(f"Daily comment limit reached ({self.max_daily_comments}).")
        if self.memory.has_commented(post_url):
            raise RuntimeError(f"Already commented on {post_url}.")

        comment_id = self.playwright.post_comment(post_url=post_url, text=text)
        if comment_id is None:
            raise RuntimeError("Failed to post comment.")

        if not self.playwright.dry_run:
            self.memory.mark_commented(post_url)
            self.memory.log_entry({
                "type": "comment",
                "post_url": post_url,
                "comment": text,
                "comment_id": comment_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        return text

    def comment_llm(self, post_url: str, extra_context: str = "") -> str:
        if self.memory.daily_comment_count() >= self.max_daily_comments:
            raise RuntimeError(f"Daily comment limit reached ({self.max_daily_comments}).")
        if self.memory.has_commented(post_url):
            raise RuntimeError(f"Already commented on {post_url}.")

        system = render(
            self._prompts["system_prompt"],
            product_context=self._product_context,
            brand_voice=self._brand_voice,
            hashtag_guide="No hashtag guide available for Facebook.",
        )
        user = render(
            self._prompts["user_prompt"],
            post_caption=extra_context or "No caption context provided.",
            hashtags="none",
            permalink=post_url,
        )

        comment_text = self.llm.chat(system=system, user=user)

        if not self._self_critique(extra_context or "", comment_text):
            raise RuntimeError(f"Comment for {post_url} rejected by self-critique.")

        comment_id = self.playwright.post_comment(post_url=post_url, text=comment_text)
        if comment_id is None:
            raise RuntimeError("Failed to post comment.")

        if not self.playwright.dry_run:
            self.memory.mark_commented(post_url)
            self.memory.log_entry({
                "type": "comment",
                "post_url": post_url,
                "comment": comment_text,
                "comment_id": comment_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        return comment_text

    def _self_critique(self, post_caption: str, comment: str) -> bool:
        import json as _json

        user_msg = _SELF_CRITIQUE_USER.format(
            post_caption=post_caption[:300], comment=comment
        )
        try:
            raw = self.llm.chat(system=_SELF_CRITIQUE_SYSTEM, user=user_msg)
            raw = raw.strip().strip("```json").strip("```").strip()
            result = _json.loads(raw)
            approved = result.get("approved", False)
            if not approved:
                logger.debug("Self-critique rejected: %s", result.get("feedback", ""))
            return bool(approved)
        except Exception as exc:
            logger.warning("Self-critique failed: %s", exc)
            return False
