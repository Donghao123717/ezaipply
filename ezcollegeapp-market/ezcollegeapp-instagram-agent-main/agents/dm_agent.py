"""
DM Agent: sends Instagram direct messages with explicit mode split.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from tools.instagrapi_tool import InstagrapiTool
from tools.llm_client import LLMClient
from tools.memory_tool import MemoryTool
from tools.prompt_loader import load_md, load_yaml_prompt, render

logger = logging.getLogger(__name__)


class DMAgent:
    """
    Sends direct messages through instagrapi.

    Modes:
      - dm_manual: caller provides final message text
      - dm_llm: message generated from provided materials
    """

    def __init__(self, llm: LLMClient, instagrapi: InstagrapiTool, memory: MemoryTool):
        self.llm = llm
        self.instagrapi = instagrapi
        self.memory = memory
        self._prompts = load_yaml_prompt("dm_prompt.yaml")
        self._product_context = load_md("product_context.md")
        self._brand_voice = load_md("brand_voice.md")

    def dm_manual(self, username: str, text: str) -> str:
        if not text.strip():
            raise ValueError("text is required for dm_manual")

        thread_id = self.instagrapi.send_dm(username=username, text=text)
        if thread_id is None:
            raise RuntimeError(f"Failed to send DM to @{username}")

        self.memory.log_entry(
            {
                "type": "dm",
                "username": username,
                "text": text,
                "thread_id": thread_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        logger.info("DM sent to @%s", username)
        return text

    def dm_llm(self, username: str, materials: str, extra_context: str = "") -> str:
        if not materials.strip():
            raise ValueError("materials is required for dm_llm")

        system = render(
            self._prompts["system_prompt"],
            product_context=self._product_context,
            brand_voice=self._brand_voice,
        )
        user = render(
            self._prompts["user_prompt"],
            target_username=username,
            materials=materials,
            extra_context=extra_context or "No additional context provided.",
        )

        message = self.llm.chat(system=system, user=user).strip()
        if not message:
            raise RuntimeError(f"Generated empty DM for @{username}")

        self.dm_manual(username=username, text=message)
        return message
