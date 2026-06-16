"""
Post Agent: publishes Facebook feed posts with a photo/video and LLM-generated caption.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from tools.playwright_tool import PlaywrightTool
from tools.llm_client import LLMClient
from tools.memory_tool import MemoryTool
from tools.prompt_loader import load_md, load_yaml_prompt, render

logger = logging.getLogger(__name__)

POST_FORMATS = ("story", "tips", "question")


class PostAgent:
    def __init__(
        self,
        llm: LLMClient,
        playwright: PlaywrightTool,
        memory: MemoryTool,
        max_daily_posts: int = 2,
    ):
        self.llm = llm
        self.playwright = playwright
        self.memory = memory
        self.max_daily_posts = max_daily_posts
        self._prompts = load_yaml_prompt("caption_prompt.yaml")
        self._product_context = load_md("product_context.md")
        self._brand_voice = load_md("brand_voice.md")

    def post_manual(self, media_path: str, caption: str) -> str:
        if not caption.strip():
            raise ValueError("caption is required for post_manual")
        if self.memory.daily_post_count() >= self.max_daily_posts:
            raise RuntimeError(f"Daily post limit reached ({self.max_daily_posts}).")

        post_id = self.playwright.publish_post(media_path=media_path, caption=caption)
        if post_id is None:
            raise RuntimeError("Failed to publish post.")

        if not self.playwright.dry_run:
            self.memory.increment_post_count()
            self.memory.log_entry({
                "type": "post",
                "media": media_path,
                "caption": caption,
                "post_id": post_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        logger.info("Facebook post created (%s)", post_id)
        return caption

    def post_llm(
        self,
        media_path: str,
        post_format: str = "story",
        extra_context: str = "",
    ) -> str:
        if post_format not in POST_FORMATS:
            raise ValueError(f"post_format must be one of {POST_FORMATS}")
        if self.memory.daily_post_count() >= self.max_daily_posts:
            raise RuntimeError(f"Daily post limit reached ({self.max_daily_posts}).")

        system = render(
            self._prompts["system_prompt"],
            product_context=self._product_context,
            brand_voice=self._brand_voice,
        )
        user = render(
            self._prompts["user_prompt"],
            post_format=post_format,
            extra_context=extra_context or "No additional context provided.",
        )

        raw = self.llm.chat(system=system, user=user)
        caption = self._parse_caption(raw)
        if not caption:
            raise RuntimeError("Failed to parse caption from LLM output.")

        return self.post_manual(media_path=media_path, caption=caption)

    def _parse_caption(self, raw: str) -> str | None:
        lines = raw.strip().splitlines()
        caption_lines: list[str] = []
        in_caption = False
        for line in lines:
            if line.startswith("CAPTION:"):
                in_caption = True
                inline = line[len("CAPTION:"):].strip()
                if inline:
                    caption_lines.append(inline)
            elif in_caption:
                caption_lines.append(line)
        caption = "\n".join(caption_lines).strip()
        return caption or None
