"""OpenAI LLM provider.

Mirrors the OpenAI SDK usage pattern established in chatbot_service.py:
`from openai import OpenAI`, `OpenAI(api_key=...)`,
`.chat.completions.create(...)`.
"""
import os
from typing import Any, Dict, List, Optional

from .llm_interface import LLMProvider


class OpenAIProvider(LLMProvider):
    """LLM provider backed by the OpenAI API (chat + vision)."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Args:
            config: Optional configuration dictionary. Supported keys:
                - OPENAI_API_KEY
                - OPENAI_MODEL (default: 'gpt-4o-mini')
                - OPENAI_VISION_MODEL (default: 'gpt-4o')
                - OPENAI_TRANSCRIBE_MODEL (default: 'whisper-1')
            Falls back to the corresponding environment variables (e.g.
            OPENAI_API_KEY) when a value isn't present in `config`.
        """
        config = config or {}
        self.config = config

        self.api_key = config.get('OPENAI_API_KEY') or os.environ.get('OPENAI_API_KEY')
        self.model = config.get('OPENAI_MODEL') or os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
        self.vision_model = config.get('OPENAI_VISION_MODEL') or os.environ.get('OPENAI_VISION_MODEL', 'gpt-4o')
        self.transcribe_model = (
            config.get('OPENAI_TRANSCRIBE_MODEL')
            or os.environ.get('OPENAI_TRANSCRIBE_MODEL', 'whisper-1')
        )

        self.client = None

        # Construct the underlying SDK client eagerly so callers using
        # Convention A (LLMProviderFactory.create(...).chat_completion(...))
        # can use the provider immediately with no separate init step.
        self.initialize()

    def initialize(self) -> bool:
        """Set up the OpenAI client. Idempotent/safe to call more than once.

        Returns True if the client is ready to use, False otherwise.
        """
        if self.client is not None:
            return True

        if not self.api_key:
            raise ValueError(
                "OPENAI_API_KEY is required to initialize OpenAIProvider "
                "(pass it via config['OPENAI_API_KEY'] or set the "
                "OPENAI_API_KEY environment variable)."
            )

        from openai import OpenAI

        self.client = OpenAI(api_key=self.api_key)
        return True

    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        model: Optional[str] = None,
    ) -> Dict[str, str]:
        """Run a chat completion via the OpenAI API.

        `messages` follows the OpenAI chat format. `content` may be a plain
        string or a list of content blocks (text/image_url) for multimodal
        input - both are passed straight through to the SDK, which already
        supports this format for vision.

        Returns:
            {'content': <str>}
        """
        if not self.client:
            self.initialize()

        create_kwargs: Dict[str, Any] = {
            'model': model or self.model,
            'messages': messages,
            'temperature': temperature,
        }
        if max_tokens is not None:
            create_kwargs['max_tokens'] = max_tokens

        response = self.client.chat.completions.create(**create_kwargs)

        content = response.choices[0].message.content
        return {'content': content}
