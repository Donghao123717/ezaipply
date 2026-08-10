"""Minimal Gemini LLM provider stub.

Not used by this project's demo (OpenAI is the only fully-implemented
provider). Construction never fails just because 'gemini' was selected as
the LLM_PROVIDER - only calling chat_completion() raises.
"""
import os
from typing import Any, Dict, List, Optional

from .llm_interface import LLMProvider


class GeminiProvider(LLMProvider):
    """Stub LLM provider for Google Gemini. Not implemented."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        config = config or {}
        self.config = config
        self.api_key = config.get('GEMINI_API_KEY') or os.environ.get('GEMINI_API_KEY')
        self.model = config.get('GEMINI_MODEL') or os.environ.get('GEMINI_MODEL', 'gemini-2.0-flash')
        self.vision_model = (
            config.get('GEMINI_VISION_MODEL') or os.environ.get('GEMINI_VISION_MODEL', 'gemini-1.5-pro')
        )
        self.client = None

    def initialize(self) -> bool:
        """Marks the provider as constructed. Does not require an API key
        since Gemini support isn't actually implemented yet."""
        return True

    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
    ) -> Dict[str, str]:
        raise NotImplementedError(
            "GeminiProvider.chat_completion is not implemented. "
            "Set LLM_PROVIDER=openai to use the fully implemented provider."
        )
