"""
DM Agent: sends Facebook Messenger direct messages.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from tools.playwright_tool import PlaywrightTool
from tools.llm_client import LLMClient
from tools.memory_tool import MemoryTool
from tools.prompt_loader import load_md, load_yaml_prompt, render

logger = logging.getLogger(__name__)


class DMAgent:
    def __init__(
        self,
        llm: LLMClient,
        playwright: PlaywrightTool,
        memory: MemoryTool,
    ):
        self.llm = llm
        self.playwright = playwright
        self.memory = memory
        self._prompts = load_yaml_prompt("dm_prompt.yaml")
        self._product_context = load_md("product_context.md")
        self._brand_voice = load_md("brand_voice.md")

    def dm_manual(self, target: str, text: str) -> str:
        if not text.strip():
            raise ValueError("text is required for dm_manual")

        result = self.playwright.send_dm(target=target, text=text)
        if result is None:
            raise RuntimeError(f"Failed to send DM to @{target}")

        if not self.playwright.dry_run:
            self.memory.log_entry({
                "type": "dm",
                "target": target,
                "text": text,
                "thread_id": result,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        logger.info("DM sent to @%s", target)
        return text

    def dm_llm(self, target: str, materials: str, extra_context: str = "") -> str:
        if not materials.strip():
            raise ValueError("materials is required for dm_llm")

        system = render(
            self._prompts["system_prompt"],
            product_context=self._product_context,
            brand_voice=self._brand_voice,
        )
        user = render(
            self._prompts["user_prompt"],
            target_username=target,
            materials=materials,
            extra_context=extra_context or "No additional context provided.",
        )

        message = self.llm.chat(system=system, user=user).strip()
        if not message:
            raise RuntimeError(f"Generated empty DM for @{target}")

        return self.dm_manual(target=target, text=message)
