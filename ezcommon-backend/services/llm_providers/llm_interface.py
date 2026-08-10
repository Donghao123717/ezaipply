"""Abstract interface that all LLM providers must implement.

Mirrors the shape of services/search_providers/search_interface.py so both
provider packages follow the same convention in this repo.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class LLMProvider(ABC):
    """Common interface for chat-completion style LLM backends (OpenAI, Gemini, Bedrock, ...)."""

    @abstractmethod
    def initialize(self) -> bool:
        """Set up the underlying SDK client/connection.

        Must be safe to call more than once (idempotent). Returns True if the
        provider is ready to use, False otherwise.
        """
        raise NotImplementedError

    @abstractmethod
    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
    ) -> Dict[str, str]:
        """Run a chat completion.

        Args:
            messages: OpenAI-style chat messages, e.g.
                [{"role": "user", "content": "..."}]
                `content` may also be a list of content blocks (for
                multimodal/vision input), e.g.
                [{"type": "text", "text": "..."},
                 {"type": "image_url", "image_url": {"url": "..."}}]
            temperature: Sampling temperature.
            max_tokens: Optional max tokens to generate.

        Returns:
            {'content': <str>} - the plain-text response content.
        """
        raise NotImplementedError
