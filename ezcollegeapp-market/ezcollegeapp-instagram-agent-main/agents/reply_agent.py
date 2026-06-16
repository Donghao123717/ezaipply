"""
Reply Agent: fetches comments on a specified Instagram post and replies to each
unreplied comment using an LLM-generated response.

Uses the instagrapi unofficial API, so it works with personal Instagram accounts.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from tools.instagrapi_tool import IGCommentData, InstagrapiTool
from tools.llm_client import LLMClient
from tools.memory_tool import MemoryTool
from tools.prompt_loader import load_md, load_yaml_prompt, render

logger = logging.getLogger(__name__)


class ReplyAgent:
    """
    Fetches comments on a post (by URL or latest from a username) and replies
    to each one that hasn't been replied to yet.
    """

    def __init__(
        self,
        llm: LLMClient,
        instagrapi: InstagrapiTool,
        memory: MemoryTool,
        max_replies_per_run: int = 10,
    ):
        self.llm = llm
        self.instagrapi = instagrapi
        self.memory = memory
        self.max_replies_per_run = max_replies_per_run
        self._prompts = load_yaml_prompt("reply_prompt.yaml")
        self._product_context = load_md("product_context.md")
        self._brand_voice = load_md("brand_voice.md")

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def reply_llm(
        self,
        username: str,
        post_url: str = "",
        extra_context: str = "",
    ) -> int:
        """
        Reply to comments on a post using LLM-generated replies.

        Args:
            username:      Instagram username of the post owner (used to find
                           the latest post when post_url is not given).
            post_url:      Full URL of a specific post. If omitted, the agent
                           uses the account's most recent post.
            extra_context: Optional hint about tone or topic to guide replies.

        Returns:
            Number of comments replied to this run.
        """
        post_info = self._resolve_post(username, post_url)
        if post_info is None:
            return 0

        media_id, permalink, post_caption = post_info
        logger.info("Targeting post %s (%s)", media_id, permalink)

        comments = self.instagrapi.get_comments(media_id)
        logger.info("Found %d top-level comment(s)", len(comments))

        replied = 0
        for comment in comments:
            if replied >= self.max_replies_per_run:
                logger.info(
                    "Reached max_replies_per_run (%d). Stopping.",
                    self.max_replies_per_run,
                )
                break

            if self.memory.has_replied_to_comment(comment.comment_id):
                logger.debug("Already replied to comment %s. Skipping.", comment.comment_id)
                continue

            reply_text = self._generate_reply(post_caption, comment, extra_context)

            reply_id = self.instagrapi.reply_to_comment(
                media_id=media_id,
                comment_id=comment.comment_id,
                text=reply_text,
            )

            if reply_id:
                self.memory.mark_replied_to_comment(comment.comment_id)
                self.memory.log_entry(
                    {
                        "type": "comment_reply",
                        "media_id": media_id,
                        "permalink": permalink,
                        "comment_id": comment.comment_id,
                        "commenter": comment.username,
                        "original_comment": comment.text,
                        "reply": reply_text,
                        "reply_id": reply_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
                replied += 1
                logger.info(
                    "Replied to @%s (comment %s) — %d total this run",
                    comment.username,
                    comment.comment_id,
                    replied,
                )

        logger.info("Reply run complete. Replied to %d comment(s).", replied)
        return replied

    def reply_manual(
        self,
        username: str,
        manual_replies: dict[str, str],
        post_url: str = "",
    ) -> int:
        """
        Reply to comments on a post using caller-provided per-comment text.
        """
        if not manual_replies:
            raise ValueError("manual_replies is required for reply_manual")

        post_info = self._resolve_post(username, post_url)
        if post_info is None:
            return 0

        media_id, permalink, _post_caption = post_info
        comments = self.instagrapi.get_comments(media_id)

        replied = 0
        for comment in comments:
            if replied >= self.max_replies_per_run:
                break

            if self.memory.has_replied_to_comment(comment.comment_id):
                continue

            text = manual_replies.get(comment.comment_id, "").strip()
            if not text:
                continue

            reply_id = self.instagrapi.reply_to_comment(
                media_id=media_id,
                comment_id=comment.comment_id,
                text=text,
            )
            if reply_id:
                self.memory.mark_replied_to_comment(comment.comment_id)
                self.memory.log_entry(
                    {
                        "type": "comment_reply",
                        "media_id": media_id,
                        "permalink": permalink,
                        "comment_id": comment.comment_id,
                        "commenter": comment.username,
                        "original_comment": comment.text,
                        "reply": text,
                        "reply_id": reply_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
                replied += 1

        return replied

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _resolve_post(
        self, username: str, post_url: str
    ) -> tuple[str, str, str] | None:
        if post_url:
            result = self.instagrapi.get_post_by_url(post_url)
            if result is None:
                logger.error("Could not fetch post from URL: %s", post_url)
            return result

        result = self.instagrapi.get_latest_post(username)
        if result is None:
            logger.error("Could not find any post for @%s", username)
        return result

    def _generate_reply(
        self,
        post_caption: str,
        comment: IGCommentData,
        extra_context: str,
    ) -> str:
        extra_context_section = (
            f"Additional context for your reply: {extra_context}"
            if extra_context
            else ""
        )
        system = render(
            self._prompts["system_prompt"],
            product_context=self._product_context,
            brand_voice=self._brand_voice,
        )
        user = render(
            self._prompts["user_prompt"],
            post_caption=post_caption[:600],
            commenter_username=comment.username,
            comment_text=comment.text[:300],
            extra_context_section=extra_context_section,
        )
        reply = self.llm.chat(system=system, user=user)
        logger.debug(
            "Generated reply for comment %s by @%s: %s",
            comment.comment_id,
            comment.username,
            reply[:120],
        )
        if not reply.strip():
            raise RuntimeError(f"Generated empty reply for comment {comment.comment_id}")
        return reply
