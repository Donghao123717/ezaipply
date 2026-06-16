"""
Post Agent: on-demand creation of Instagram image posts sharing a personal
experience with EZCollegeApp, aimed at students going through college apps.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from tools.instagrapi_tool import InstagrapiTool
from tools.llm_client import LLMClient
from tools.memory_tool import MemoryTool
from tools.prompt_loader import load_md, load_yaml_prompt, render

logger = logging.getLogger(__name__)

POST_FORMATS = ("story", "tips", "question")


class PostAgent:
    """
    Creates Instagram feed posts with explicit mode split:
      - post_manual: caller provides final caption
      - post_llm: caption generated from materials
    """

    def __init__(
        self,
        llm: LLMClient,
        instagrapi: InstagrapiTool,
        memory: MemoryTool,
        max_daily_posts: int = 2,
    ):
        self.llm = llm
        self.instagrapi = instagrapi
        self.memory = memory
        self.max_daily_posts = max_daily_posts
        self._prompts = load_yaml_prompt("caption_prompt.yaml")
        self._product_context = load_md("product_context.md")
        self._brand_voice = load_md("brand_voice.md")

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def post_manual(
        self,
        media_path_or_url: str,
        caption: str,
    ) -> str:
        """
        Publish a post from caller-provided content.

        Args:
            media_path_or_url: Local file path or URL to image/video.
            caption:           Final caption text.

        Returns:
            The posted caption text.
        """
        if not caption.strip():
            raise ValueError("caption is required for post_manual")

        if self.memory.daily_post_count() >= self.max_daily_posts:
            raise RuntimeError(
                f"Daily post limit reached ({self.max_daily_posts})."
            )

        media_id = self.instagrapi.publish_media_post(
            media_path_or_url=media_path_or_url,
            caption=caption,
        )

        if media_id is None:
            raise RuntimeError("Failed to publish post.")

        self.memory.increment_post_count()
        self.memory.log_entry(
            {
                "type": "post",
                "media": media_path_or_url,
                "caption": caption,
                "media_id": media_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

        logger.info("Instagram post created (media_id=%s)", media_id)
        return caption

    def post_llm(
        self,
        media_path_or_url: str,
        post_format: str = "story",
        extra_context: str = "",
    ) -> str:
        """
        Generate caption from LLM and publish the post.
        """
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

        return self.post_manual(
            media_path_or_url=media_path_or_url,
            caption=caption,
        )

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _parse_caption(self, raw: str) -> str | None:
        """
        Parse LLM output into a caption string.
        Expected format:
            CAPTION:
            <caption text including hashtags>
        """
        lines = raw.strip().splitlines()
        caption_lines: list[str] = []
        in_caption = False

        for line in lines:
            if line.startswith("CAPTION:"):
                in_caption = True
                # Support inline: CAPTION: text on same line
                inline = line[len("CAPTION:"):].strip()
                if inline:
                    caption_lines.append(inline)
            elif in_caption:
                caption_lines.append(line)

        caption = "\n".join(caption_lines).strip()
        return caption or None
