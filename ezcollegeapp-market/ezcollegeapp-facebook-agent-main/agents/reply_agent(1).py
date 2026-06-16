"""
Reply Agent: fetches comments on a Facebook post and replies to unreplied ones.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from tools.playwright_tool import FBCommentData, PlaywrightTool
from tools.llm_client import LLMClient
from tools.memory_tool import MemoryTool
from tools.prompt_loader import load_md, load_yaml_prompt, render

logger = logging.getLogger(__name__)


class ReplyAgent:
    def __init__(
        self,
        llm: LLMClient,
        playwright: PlaywrightTool,
        memory: MemoryTool,
        max_replies_per_run: int = 10,
    ):
        self.llm = llm
        self.playwright = playwright
        self.memory = memory
        self.max_replies_per_run = max_replies_per_run
        self._prompts = load_yaml_prompt("reply_prompt.yaml")
        self._product_context = load_md("product_context.md")
        self._brand_voice = load_md("brand_voice.md")

    def reply_llm(self, post_url: str, extra_context: str = "") -> int:
        """
        Reply to comments on a post using LLM-generated replies.

        Returns:
            Number of comments replied to this run.
        """
        comments = self.playwright.get_comments(post_url)
        logger.info("Found %d top-level comment(s)", len(comments))

        replied = 0
        for comment in comments:
            if replied >= self.max_replies_per_run:
                logger.info("Reached max_replies_per_run (%d). Stopping.", self.max_replies_per_run)
                break

            if self.memory.has_replied_to_comment(comment.comment_id):
                logger.debug("Already replied to comment %s. Skipping.", comment.comment_id)
                continue

            reply_text = self._generate_reply(comment, extra_context)

            reply_id = self.playwright.reply_to_comment(
                post_url=post_url,
                comment_index=comment.index,
                text=reply_text,
            )

            if reply_id:
                if not self.playwright.dry_run:
                    self.memory.mark_replied_to_comment(comment.comment_id)
                    self.memory.log_entry({
                        "type": "comment_reply",
                        "post_url": post_url,
                        "comment_id": comment.comment_id,
                        "commenter": comment.username,
                        "original_comment": comment.text,
                        "reply": reply_text,
                        "reply_id": reply_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                replied += 1
                logger.info("Replied to @%s (comment %s)", comment.username, comment.comment_id)

        logger.info("Reply run complete. Replied to %d comment(s).", replied)
        return replied

    def reply_manual(
        self, post_url: str, manual_replies: dict[str, str]
    ) -> int:
        """
        Reply to comments using caller-provided per-comment text.
        manual_replies maps comment_id -> reply text.
        """
        if not manual_replies:
            raise ValueError("manual_replies is required for reply_manual")

        comments = self.playwright.get_comments(post_url)
        replied = 0

        for comment in comments:
            if replied >= self.max_replies_per_run:
                break
            if self.memory.has_replied_to_comment(comment.comment_id):
                continue

            text = manual_replies.get(comment.comment_id, "").strip()
            if not text:
                continue

            reply_id = self.playwright.reply_to_comment(
                post_url=post_url,
                comment_index=comment.index,
                text=text,
            )
            if reply_id:
                if not self.playwright.dry_run:
                    self.memory.mark_replied_to_comment(comment.comment_id)
                    self.memory.log_entry({
                        "type": "comment_reply",
                        "post_url": post_url,
                        "comment_id": comment.comment_id,
                        "commenter": comment.username,
                        "original_comment": comment.text,
                        "reply": text,
                        "reply_id": reply_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                replied += 1

        return replied

    def _generate_reply(self, comment: FBCommentData, extra_context: str) -> str:
        extra_section = (
            f"Additional context: {extra_context}" if extra_context else ""
        )
        system = render(
            self._prompts["system_prompt"],
            product_context=self._product_context,
            brand_voice=self._brand_voice,
        )
        user = render(
            self._prompts["user_prompt"],
            post_caption=comment.post_url,
            commenter_username=comment.username,
            comment_text=comment.text[:300],
            extra_context_section=extra_section,
        )
        reply = self.llm.chat(system=system, user=user)
        if not reply.strip():
            raise RuntimeError(f"Generated empty reply for comment {comment.comment_id}")
        return reply
