"""Minimal AWS Bedrock LLM provider stub.

Not used by this project's demo (OpenAI is the only fully-implemented
provider). Construction never fails just because 'bedrock' was selected as
the LLM_PROVIDER - only calling chat_completion() raises.
"""
import os
from typing import Any, Dict, List, Optional

from .llm_interface import LLMProvider


class BedrockProvider(LLMProvider):
    """Stub LLM provider for AWS Bedrock. Not implemented."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        config = config or {}
        self.config = config
        self.region = config.get('AWS_REGION') or os.environ.get('AWS_REGION', 'us-east-1')
        self.model = (
            config.get('BEDROCK_MODEL')
            or os.environ.get('BEDROCK_MODEL', 'anthropic.claude-3-5-sonnet-20241022-v2:0')
        )
        self.client = None

    def initialize(self) -> bool:
        """Marks the provider as constructed. Does not require AWS
        credentials since Bedrock support isn't actually implemented yet."""
        return True

    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
    ) -> Dict[str, str]:
        raise NotImplementedError(
            "BedrockProvider.chat_completion is not implemented. "
            "Set LLM_PROVIDER=openai to use the fully implemented provider."
        )
