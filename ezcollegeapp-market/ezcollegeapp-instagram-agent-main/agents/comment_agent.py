"""
Comment Agent: crafts a helpful Instagram comment from the perspective of a student
who used EZCollegeApp, sharing personal experience and advice.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

from tools.instagrapi_tool import InstagrapiTool
from tools.llm_client import LLMClient
from tools.memory_tool import MemoryTool
from tools.prompt_loader import load_md, load_hashtag_guide, load_yaml_prompt, render

logger = logging.getLogger(__name__)

_SELF_CRITIQUE_SYSTEM = """
You are an Instagram content quality reviewer. Given a draft comment on an Instagram post,
decide whether it is good enough to publish and return ONLY a JSON object:
{
  "approved": true or false,
  "feedback": "one-sentence reason if rejected"
}

Approve if:
- The comment genuinely engages with the post's topic with real, useful advice
- The tone is warm, casual, and peer-like — as if written by a fellow student
- Any mention of EZCollegeApp is brief (1 sentence), comes AFTER the real advice,
  and reads like personal experience ("I used it for X") not a pitch
- Hashtags or emojis feel natural, not spammy

Reject ONLY if:
- The comment is mostly promotional with little genuine engagement
- The comment ignores what the post is actually about
- The comment opens with a product mention instead of real engagement
- The comment makes false claims (e.g. guarantees admission)
- The comment looks like a bot reply (generic, no personal touch)

When in doubt, approve — a helpful student comment with a soft personal mention is fine.
"""

_SELF_CRITIQUE_USER = """
Original post caption: {post_caption}
Draft comment:
{comment}

Approve or reject?
"""


class CommentAgent:
    """
    Generates a comment for an Instagram post using the LLM,
    runs a self-critique pass, and submits if approved.
    """

    def __init__(
        self,
        llm: LLMClient,
        instagrapi: InstagrapiTool,
        memory: MemoryTool,
        max_daily_comments: int = 15,
    ):
        self.llm = llm
        self.instagrapi = instagrapi
        self.memory = memory
        self.max_daily_comments = max_daily_comments
        self._prompts = load_yaml_prompt("comment_prompt.yaml")
        self._product_context = load_md("product_context.md")
        self._brand_voice = load_md("brand_voice.md")

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def comment_manual(self, post_url: str, text: str) -> str:
        """
        Post a caller-provided top-level comment on a post URL.
        """
        if not text.strip():
            raise ValueError("text is required for comment_manual")

        post_info = self.instagrapi.get_post_by_url(post_url)
        if post_info is None:
            raise RuntimeError(f"Post not found: {post_url}")

        media_id, permalink, post_caption = post_info

        if self.memory.daily_comment_count() >= self.max_daily_comments:
            raise RuntimeError(
                f"Daily comment limit reached ({self.max_daily_comments})."
            )

        if self.memory.has_commented(media_id):
            raise RuntimeError(f"Already commented on media {media_id}.")

        comment_id = self.instagrapi.post_comment(media_id, text)
        if comment_id is None:
            raise RuntimeError("Failed to post comment.")

        self.memory.mark_commented(media_id)
        self.memory.log_entry(
            {
                "type": "comment",
                "media_id": media_id,
                "caption_snippet": post_caption[:120],
                "permalink": permalink,
                "comment": text,
                "comment_id": comment_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        return text

    def comment_llm(self, post_url: str, extra_context: str = "") -> str:
        """
        Generate and post a comment for a post URL.
        """
        post_info = self.instagrapi.get_post_by_url(post_url)
        if post_info is None:
            raise RuntimeError(f"Post not found: {post_url}")

        media_id, permalink, post_caption = post_info

        if self.memory.daily_comment_count() >= self.max_daily_comments:
            raise RuntimeError(f"Daily comment limit reached ({self.max_daily_comments}).")

        if self.memory.has_commented(media_id):
            raise RuntimeError(f"Already commented on media {media_id}.")

        hashtags = _extract_hashtags(post_caption)

        hashtag_guide = load_hashtag_guide(
            hashtags[0] if hashtags else ""
        )

        system = render(
            self._prompts["system_prompt"],
            product_context=self._product_context,
            brand_voice=self._brand_voice,
            hashtag_guide=hashtag_guide or "No specific hashtag guide available.",
        )
        user = render(
            self._prompts["user_prompt"],
            post_caption=(post_caption + "\n\n" + extra_context).strip()[:800],
            hashtags=", ".join(f"#{h}" for h in hashtags) or "none",
            permalink=permalink,
        )

        comment_text = self.llm.chat(system=system, user=user)
        logger.debug("Generated comment for media %s:\n%s", media_id, comment_text[:200])

        if not self._self_critique(post_caption, comment_text):
            raise RuntimeError(f"Comment for media {media_id} rejected by self-critique.")

        comment_id = self.instagrapi.post_comment(media_id, comment_text)
        if comment_id is None:
            raise RuntimeError("Failed to post comment.")

        self.memory.mark_commented(media_id)
        self.memory.log_entry(
            {
                "type": "comment",
                "media_id": media_id,
                "caption_snippet": post_caption[:120],
                "permalink": permalink,
                "comment": comment_text,
                "comment_id": comment_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        return comment_text

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

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
            feedback = result.get("feedback", "")
            if not approved:
                logger.debug("Self-critique rejected comment: %s", feedback)
            return bool(approved)
        except Exception as exc:
            logger.warning("Self-critique failed: %s", exc)
            return False


def _extract_hashtags(text: str) -> list[str]:
    tags = re.findall(r"#([A-Za-z0-9_]+)", text or "")
    return [tag.lower() for tag in tags]
