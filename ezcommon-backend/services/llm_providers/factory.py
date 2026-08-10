"""Factory for creating LLM provider instances from environment variables.

This is "Convention B", used by plugin_api.py (initialize_llm_provider):
    llm_provider = LLMFactory.create_provider(provider_type)
    if not llm_provider.initialize():
        raise RuntimeError(...)

Unlike LLMProviderFactory (services/llm_providers/__init__.py), this reads
configuration directly from os.environ rather than a passed-in config dict.
"""
import os
from typing import Any, Dict

from .llm_interface import LLMProvider


def _build_config_from_env() -> Dict[str, Any]:
    """Build an LLM provider configuration dictionary from environment
    variables, matching the shape LLMProviderFactory.create() expects."""
    return {
        'LLM_PROVIDER': os.environ.get('LLM_PROVIDER', 'openai'),
        'OPENAI_API_KEY': os.environ.get('OPENAI_API_KEY'),
        'OPENAI_MODEL': os.environ.get('OPENAI_MODEL', 'gpt-4o-mini'),
        'OPENAI_VISION_MODEL': os.environ.get('OPENAI_VISION_MODEL', 'gpt-4o'),
        'OPENAI_TRANSCRIBE_MODEL': os.environ.get('OPENAI_TRANSCRIBE_MODEL', 'whisper-1'),
        'GEMINI_API_KEY': os.environ.get('GEMINI_API_KEY'),
        'GEMINI_MODEL': os.environ.get('GEMINI_MODEL', 'gemini-2.0-flash'),
        'GEMINI_VISION_MODEL': os.environ.get('GEMINI_VISION_MODEL', 'gemini-1.5-pro'),
        'AWS_REGION': os.environ.get('AWS_REGION', 'us-east-1'),
        'BEDROCK_MODEL': os.environ.get('BEDROCK_MODEL', 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
    }


class LLMFactory:
    """Factory for creating LLM provider instances based on environment
    configuration (see also LLMProviderFactory for the config-dict based
    convention)."""

    @staticmethod
    def create_provider(provider_type: str = 'openai') -> LLMProvider:
        """
        Create an LLM provider instance for `provider_type`, reading all
        configuration from environment variables.

        Note: unlike LLMProviderFactory.create(), the returned provider is
        NOT guaranteed to be fully initialized yet - callers are expected to
        explicitly call `.initialize()` and check the return value:

            llm_provider = LLMFactory.create_provider(provider_type)
            if not llm_provider.initialize():
                raise RuntimeError(...)

        Args:
            provider_type: 'openai', 'gemini', or 'bedrock'.

        Returns:
            LLMProvider instance.

        Raises:
            ValueError: If provider_type is not supported.
        """
        provider_type = (provider_type or 'openai').lower()
        config = _build_config_from_env()

        if provider_type == 'openai':
            from .openai_provider import OpenAIProvider
            return OpenAIProvider(config)

        elif provider_type == 'gemini':
            from .gemini_provider import GeminiProvider
            return GeminiProvider(config)

        elif provider_type == 'bedrock':
            from .bedrock_provider import BedrockProvider
            return BedrockProvider(config)

        else:
            raise ValueError(
                f"Unsupported LLM provider: {provider_type}. "
                f"Supported providers: openai, gemini, bedrock"
            )
