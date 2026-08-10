"""
Tests for services/llm_providers/.

Mocks the OpenAI SDK entirely - no real API calls, network access, or API
key required to run these tests.
"""
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

# Ensure the repo root is importable when running this file directly.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.llm_providers import LLMProviderFactory, LLMProvider, OpenAIProvider
from services.llm_providers.factory import LLMFactory
from services.llm_providers.openai_provider import OpenAIProvider as OpenAIProviderDirect


def _make_fake_openai_client(response_text="Hello from mocked OpenAI!"):
    """Build a MagicMock standing in for `openai.OpenAI(...)` whose
    `.chat.completions.create(...)` returns an object shaped like the real
    SDK response (response.choices[0].message.content)."""
    fake_message = SimpleNamespace(content=response_text)
    fake_choice = SimpleNamespace(message=fake_message)
    fake_response = SimpleNamespace(choices=[fake_choice])

    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = fake_response
    return fake_client


@pytest.fixture
def mock_openai_class(mocker):
    """Patch the `openai.OpenAI` class so OpenAIProvider never touches the
    network. Returns the MagicMock class; `mock_openai_class.return_value`
    is the fake client instance."""
    fake_client = _make_fake_openai_client()
    mock_cls = mocker.patch("openai.OpenAI", return_value=fake_client)
    return mock_cls


# ---------------------------------------------------------------------------
# Convention A: LLMProviderFactory.create(config_dict)
# ---------------------------------------------------------------------------

class TestLLMProviderFactoryConventionA:
    def test_create_returns_openai_provider(self, mock_openai_class):
        config = {
            'LLM_PROVIDER': 'openai',
            'OPENAI_API_KEY': 'fake-key',
            'OPENAI_MODEL': 'gpt-4o-mini',
            'OPENAI_VISION_MODEL': 'gpt-4o',
        }
        provider = LLMProviderFactory.create(config)

        assert isinstance(provider, OpenAIProvider)
        assert isinstance(provider, LLMProvider)
        # Client should already be constructed eagerly - no separate init step.
        assert provider.client is not None

    def test_create_provider_ready_immediately_chat_completion(self, mock_openai_class):
        """Caller does LLMProviderFactory.create(config).chat_completion(...)
        with no separate init step."""
        config = {
            'LLM_PROVIDER': 'openai',
            'OPENAI_API_KEY': 'fake-key',
        }
        provider = LLMProviderFactory.create(config)

        response = provider.chat_completion(
            messages=[{"role": "user", "content": "hi"}],
            temperature=0.7,
        )

        assert response == {'content': 'Hello from mocked OpenAI!'}
        mock_openai_class.return_value.chat.completions.create.assert_called_once()
        call_kwargs = mock_openai_class.return_value.chat.completions.create.call_args.kwargs
        assert call_kwargs['model'] == 'gpt-4o-mini'
        assert call_kwargs['messages'] == [{"role": "user", "content": "hi"}]
        assert call_kwargs['temperature'] == 0.7

    def test_chat_completion_passes_max_tokens_when_provided(self, mock_openai_class):
        config = {'LLM_PROVIDER': 'openai', 'OPENAI_API_KEY': 'fake-key'}
        provider = LLMProviderFactory.create(config)

        provider.chat_completion(
            messages=[{"role": "user", "content": "hi"}],
            temperature=0.0,
            max_tokens=1024,
        )

        call_kwargs = mock_openai_class.return_value.chat.completions.create.call_args.kwargs
        assert call_kwargs['max_tokens'] == 1024

    def test_chat_completion_supports_multimodal_content_blocks(self, mock_openai_class):
        """Vision-style messages (list of content blocks) must pass straight
        through to the SDK untouched."""
        config = {'LLM_PROVIDER': 'openai', 'OPENAI_API_KEY': 'fake-key'}
        provider = LLMProviderFactory.create(config)

        multimodal_messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "What is in this image?"},
                    {"type": "image_url", "image_url": {"url": "data:image/png;base64,AAAA"}},
                ],
            }
        ]

        response = provider.chat_completion(messages=multimodal_messages)

        assert response == {'content': 'Hello from mocked OpenAI!'}
        call_kwargs = mock_openai_class.return_value.chat.completions.create.call_args.kwargs
        assert call_kwargs['messages'] == multimodal_messages

    def test_unsupported_provider_raises_value_error(self):
        config = {'LLM_PROVIDER': 'not-a-real-provider'}
        with pytest.raises(ValueError):
            LLMProviderFactory.create(config)

    def test_gemini_provider_constructs_without_raising(self):
        """Config dict always includes all providers' keys regardless of
        which is selected - selecting 'gemini' must not crash on
        construction, only when chat_completion is actually called."""
        config = {'LLM_PROVIDER': 'gemini', 'GEMINI_API_KEY': None, 'OPENAI_API_KEY': None}
        provider = LLMProviderFactory.create(config)
        assert provider is not None
        assert provider.initialize() is True

        with pytest.raises(NotImplementedError):
            provider.chat_completion(messages=[{"role": "user", "content": "hi"}])

    def test_bedrock_provider_constructs_without_raising(self):
        config = {'LLM_PROVIDER': 'bedrock', 'AWS_REGION': 'us-east-1', 'OPENAI_API_KEY': None}
        provider = LLMProviderFactory.create(config)
        assert provider is not None
        assert provider.initialize() is True

        with pytest.raises(NotImplementedError):
            provider.chat_completion(messages=[{"role": "user", "content": "hi"}])

    def test_missing_api_key_raises_clear_error(self, monkeypatch):
        """Missing API key should be handled gracefully - raise a clear,
        specific error rather than crashing with an unrelated traceback."""
        monkeypatch.delenv('OPENAI_API_KEY', raising=False)
        config = {'LLM_PROVIDER': 'openai', 'OPENAI_API_KEY': None}
        with pytest.raises(ValueError, match="OPENAI_API_KEY"):
            LLMProviderFactory.create(config)

    def test_falls_back_to_environment_variable_for_api_key(self, mock_openai_class, monkeypatch):
        """Per the OpenAI SDK usage pattern in chatbot_service.py, missing
        config value should fall back to os.environ.get('OPENAI_API_KEY')."""
        monkeypatch.setenv('OPENAI_API_KEY', 'env-fallback-key')
        config = {'LLM_PROVIDER': 'openai'}

        provider = LLMProviderFactory.create(config)

        assert provider.api_key == 'env-fallback-key'


# ---------------------------------------------------------------------------
# Convention B: LLMFactory.create_provider(provider_type) + .initialize()
# ---------------------------------------------------------------------------

class TestLLMFactoryConventionB:
    def test_create_provider_then_initialize_returns_true(self, mock_openai_class, monkeypatch):
        monkeypatch.setenv('OPENAI_API_KEY', 'fake-key')

        llm_provider = LLMFactory.create_provider('openai')

        assert llm_provider is not None
        assert llm_provider.initialize() is True

    def test_provider_from_convention_b_works_for_chat_completion(self, mock_openai_class, monkeypatch):
        monkeypatch.setenv('OPENAI_API_KEY', 'fake-key')

        llm_provider = LLMFactory.create_provider('openai')
        assert llm_provider.initialize()

        response = llm_provider.chat_completion(
            messages=[{"role": "system", "content": "sys"}, {"role": "user", "content": "hi"}],
            temperature=0.7,
        )

        assert response == {'content': 'Hello from mocked OpenAI!'}

    def test_initialize_is_idempotent(self, mock_openai_class, monkeypatch):
        monkeypatch.setenv('OPENAI_API_KEY', 'fake-key')

        llm_provider = LLMFactory.create_provider('openai')
        assert llm_provider.initialize() is True
        assert llm_provider.initialize() is True
        # Client should only be constructed once.
        assert mock_openai_class.call_count == 1

    def test_default_provider_type_is_openai(self, mock_openai_class, monkeypatch):
        monkeypatch.setenv('OPENAI_API_KEY', 'fake-key')

        llm_provider = LLMFactory.create_provider()

        assert isinstance(llm_provider, OpenAIProviderDirect)

    def test_unsupported_provider_type_raises_value_error(self):
        with pytest.raises(ValueError):
            LLMFactory.create_provider('not-a-real-provider')

    def test_missing_api_key_raises_clear_error(self, monkeypatch):
        monkeypatch.delenv('OPENAI_API_KEY', raising=False)

        with pytest.raises(ValueError, match="OPENAI_API_KEY"):
            LLMFactory.create_provider('openai')


# ---------------------------------------------------------------------------
# OpenAIProvider direct construction / misc behavior
# ---------------------------------------------------------------------------

class TestOpenAIProviderDirect:
    def test_default_models_used_when_not_specified(self, mock_openai_class):
        provider = OpenAIProviderDirect({'OPENAI_API_KEY': 'fake-key'})

        assert provider.model == 'gpt-4o-mini'
        assert provider.vision_model == 'gpt-4o'
        assert provider.transcribe_model == 'whisper-1'

    def test_custom_models_respected(self, mock_openai_class):
        provider = OpenAIProviderDirect({
            'OPENAI_API_KEY': 'fake-key',
            'OPENAI_MODEL': 'gpt-4-turbo',
            'OPENAI_VISION_MODEL': 'gpt-4-vision',
        })

        assert provider.model == 'gpt-4-turbo'
        assert provider.vision_model == 'gpt-4-vision'

    def test_response_content_returned_as_plain_dict(self, mock_openai_class):
        """Every caller does response['content'] - a plain dict key access,
        not attribute access."""
        provider = OpenAIProviderDirect({'OPENAI_API_KEY': 'fake-key'})

        response = provider.chat_completion(messages=[{"role": "user", "content": "hi"}])

        assert isinstance(response, dict)
        assert response['content'] == 'Hello from mocked OpenAI!'
