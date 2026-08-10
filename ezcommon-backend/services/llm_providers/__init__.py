"""LLM Providers Package - Abstraction layer for different LLM backends
(OpenAI, Gemini, Bedrock).

Exposes two construction conventions used across this codebase:

Convention A (this module): config-dict based, returns an already-ready
-to-use provider (used by auth_api.py, workflow/parse_documents.py,
workflow/fill_forms.py):

    llm_provider = LLMProviderFactory.create(llm_config)
    llm_provider.chat_completion(...)

Convention B (services/llm_providers/factory.py): environment-variable
based, requires an explicit initialize() call (used by plugin_api.py):

    llm_provider = LLMFactory.create_provider(provider_type)
    if not llm_provider.initialize():
        raise RuntimeError(...)
"""
from typing import Any, Dict

from .llm_interface import LLMProvider
from .openai_provider import OpenAIProvider

__all__ = ['LLMProvider', 'LLMProviderFactory', 'OpenAIProvider']


class LLMProviderFactory:
    """Factory for creating LLM provider instances based on a configuration
    dictionary. See also LLMFactory (services/llm_providers/factory.py) for
    the environment-variable based convention."""

    @staticmethod
    def create(config: Dict[str, Any]) -> LLMProvider:
        """
        Create an LLM provider instance based on configuration.

        Args:
            config: Configuration dictionary, e.g.:
                {
                    'LLM_PROVIDER': 'openai',  # or 'gemini' or 'bedrock'
                    'OPENAI_API_KEY': ...,
                    'OPENAI_MODEL': 'gpt-4o-mini',
                    'OPENAI_VISION_MODEL': 'gpt-4o',
                    'OPENAI_TRANSCRIBE_MODEL': 'whisper-1',
                    'GEMINI_API_KEY': ..., 'GEMINI_MODEL': ..., 'GEMINI_VISION_MODEL': ...,
                    'AWS_REGION': ..., 'BEDROCK_MODEL': ...,
                }

        Returns:
            A ready-to-use LLMProvider instance (the underlying SDK client
            is constructed eagerly - no separate init step required).

        Raises:
            ValueError: If provider type is not supported, or if the
                selected provider is missing required credentials (e.g. no
                OPENAI_API_KEY when LLM_PROVIDER='openai').
        """
        provider_type = (config.get('LLM_PROVIDER') or 'openai').lower()

        if provider_type == 'openai':
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
