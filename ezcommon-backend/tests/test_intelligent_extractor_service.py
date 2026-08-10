"""
Tests for services/intelligent_extractor_service.py

Uses fake/mocked search_provider and llm_provider (no real network calls), and
monkeypatches the service's own _fetch_file_bytes helper directly instead of
mocking boto3/S3, per the same pattern used in tests/test_s3_service.py.
"""
import json
import os
import sys
from unittest.mock import MagicMock

import pytest

# Make sure the repo root is importable when running pytest from elsewhere
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.intelligent_extractor_service import IntelligentExtractorService


SAMPLE_S3_FILES = [
    {
        "filename": "Transcript.pdf",
        "size": 12345,
        "url": "https://example.com/transcript.pdf",
        "s3_key": "user-uploads/user123/education/uuid_Transcript.pdf",
        "section": "education",
        "uploaded_at": "2026-01-01T00:00:00+00:00",
        "last_modified": "2026-01-01T00:00:00+00:00",
        "file_type": "application/pdf",
    },
    {
        "filename": "SAT_Scores.pdf",
        "size": 6789,
        "url": "https://example.com/sat.pdf",
        "s3_key": "user-uploads/user123/testing/uuid_SAT_Scores.pdf",
        "section": "testing",
        "uploaded_at": "2026-01-02T00:00:00+00:00",
        "last_modified": "2026-01-02T00:00:00+00:00",
        "file_type": "application/pdf",
    },
]

CANNED_LLM_JSON = json.dumps([
    {"category": "GPA", "information": "Unweighted GPA of 3.95 out of 4.0"},
    {"category": "Test Score", "information": "SAT score of 1520 (Math 780, EBRW 740)"},
    {"category": "Activity", "information": "Captain of the debate team for 3 years"},
])


@pytest.fixture
def fake_search_provider():
    provider = MagicMock()
    provider.store_document.return_value = True
    return provider


@pytest.fixture
def fake_llm_provider():
    provider = MagicMock()
    provider.chat_completion.return_value = {"content": CANNED_LLM_JSON}
    return provider


@pytest.fixture
def service(fake_search_provider, fake_llm_provider):
    return IntelligentExtractorService(
        search_provider=fake_search_provider,
        llm_provider=fake_llm_provider,
    )


class TestInit:
    def test_construction_never_raises_without_providers(self):
        # Must be safe to construct with no providers at all
        svc = IntelligentExtractorService()
        assert svc.search_provider is None
        assert svc.llm_provider is None

    def test_calls_initialize_on_search_provider(self, fake_llm_provider):
        provider = MagicMock()
        IntelligentExtractorService(search_provider=provider, llm_provider=fake_llm_provider)
        provider.initialize.assert_called_once()

    def test_initialize_failure_does_not_raise(self, fake_llm_provider):
        provider = MagicMock()
        provider.initialize.side_effect = Exception("connection refused")
        # Must not raise even if the provider's initialize() blows up
        svc = IntelligentExtractorService(search_provider=provider, llm_provider=fake_llm_provider)
        assert svc.search_provider is provider


class TestListUserFiles:
    def test_passthrough_shape(self, service, monkeypatch):
        mock_s3_service = MagicMock()
        mock_s3_service.list_user_files.return_value = SAMPLE_S3_FILES

        mock_module = MagicMock()
        mock_module.get_s3_service.return_value = mock_s3_service
        monkeypatch.setitem(sys.modules, "s3_service", mock_module)

        files = service.list_user_files("user123", "education")

        mock_s3_service.list_user_files.assert_called_once_with("user123", "education")
        assert files == SAMPLE_S3_FILES
        assert files[0]["filename"] == "Transcript.pdf"
        assert files[0]["section"] == "education"
        assert isinstance(files[0]["size"], int)

    def test_returns_empty_list_on_error(self, service, monkeypatch):
        mock_module = MagicMock()
        mock_module.get_s3_service.side_effect = Exception("boom")
        monkeypatch.setitem(sys.modules, "s3_service", mock_module)

        files = service.list_user_files("user123")
        assert files == []


class TestExtractFromFiles:
    def test_extracts_chunks_from_multiple_files(self, service, fake_llm_provider, monkeypatch):
        monkeypatch.setattr(
            service, "_fetch_file_bytes", lambda user_id, filename, section: b"%PDF fake bytes"
        )
        monkeypatch.setattr(
            service, "_extract_text", lambda filename, file_bytes: "Some transcript text with GPA and SAT info."
        )

        files = [
            {"filename": "Transcript.pdf", "section": "education"},
            {"filename": "SAT_Scores.pdf", "section": "testing"},
        ]

        result = service.extract_from_files("user123", files)

        assert result["status"] == "success"
        # 3 chunks per file * 2 files = 6
        assert result["total_chunks"] == 6
        assert len(result["chunks"]) == 6
        assert result["source_file"] == "Transcript.pdf, SAT_Scores.pdf"

        for chunk in result["chunks"]:
            assert set(chunk.keys()) == {"category", "information", "source_file", "section"}
            assert chunk["source_file"] in ("Transcript.pdf", "SAT_Scores.pdf")

        # LLM should have been called once per file
        assert fake_llm_provider.chat_completion.call_count == 2

    def test_malformed_llm_response_skips_file_without_crashing(self, service, fake_llm_provider, monkeypatch):
        monkeypatch.setattr(
            service, "_fetch_file_bytes", lambda user_id, filename, section: b"bytes"
        )
        monkeypatch.setattr(
            service, "_extract_text", lambda filename, file_bytes: "some text"
        )

        # First file: malformed JSON. Second file: valid JSON.
        responses = [
            {"content": "not valid json at all {{{"},
            {"content": CANNED_LLM_JSON},
        ]
        fake_llm_provider.chat_completion.side_effect = responses

        files = [
            {"filename": "Bad.pdf", "section": "education"},
            {"filename": "Good.pdf", "section": "testing"},
        ]

        result = service.extract_from_files("user123", files)

        assert result["status"] == "success"
        # Only the second (valid) file contributes chunks
        assert result["total_chunks"] == 3
        assert all(c["source_file"] == "Good.pdf" for c in result["chunks"])

    def test_raises_when_nothing_extracted_from_any_file(self, service, fake_llm_provider, monkeypatch):
        monkeypatch.setattr(
            service, "_fetch_file_bytes", lambda user_id, filename, section: None
        )

        files = [{"filename": "Missing.pdf", "section": "education"}]

        with pytest.raises(ValueError):
            service.extract_from_files("user123", files)

    def test_raises_when_llm_returns_malformed_json_for_only_file(self, service, fake_llm_provider, monkeypatch):
        monkeypatch.setattr(
            service, "_fetch_file_bytes", lambda user_id, filename, section: b"bytes"
        )
        monkeypatch.setattr(
            service, "_extract_text", lambda filename, file_bytes: "some text"
        )
        fake_llm_provider.chat_completion.return_value = {"content": "definitely not json"}

        files = [{"filename": "Bad.pdf", "section": "education"}]

        with pytest.raises(ValueError):
            service.extract_from_files("user123", files)

    def test_empty_files_list_raises(self, service):
        with pytest.raises(ValueError):
            service.extract_from_files("user123", [])


class TestStoreChunksToOpensearch:
    def test_calls_store_document_and_returns_count(self, service, fake_search_provider):
        chunks = [
            {"category": "GPA", "information": "3.95 GPA", "source_file": "Transcript.pdf", "section": "education"},
            {"category": "Test Score", "information": "SAT 1520", "source_file": "SAT_Scores.pdf", "section": "testing"},
        ]

        result = service.store_chunks_to_opensearch("user123", chunks, "Transcript.pdf, SAT_Scores.pdf")

        assert result["status"] == "ok"
        assert result["stored_chunks"] == 2
        assert fake_search_provider.store_document.call_count == 2

        # Verify document shape passed to store_document
        call_args = fake_search_provider.store_document.call_args_list[0][0]
        document_id, document = call_args
        assert document["user_id"] == "user123"
        assert "information_chunks" in document
        assert document["information_chunks"][0]["content"] in ("3.95 GPA", "SAT 1520")
        assert document["information_chunks"][0]["category"] in ("GPA", "Test Score")

    def test_groups_chunks_by_source_file_and_section(self, service, fake_search_provider):
        chunks = [
            {"category": "GPA", "information": "3.95 GPA", "source_file": "Transcript.pdf", "section": "education"},
            {"category": "Course", "information": "AP Biology", "source_file": "Transcript.pdf", "section": "education"},
        ]

        result = service.store_chunks_to_opensearch("user123", chunks, "Transcript.pdf")

        assert result["stored_chunks"] == 2
        # Same source_file/section -> should be grouped into a single store_document call
        assert fake_search_provider.store_document.call_count == 1
        document = fake_search_provider.store_document.call_args_list[0][0][1]
        assert len(document["information_chunks"]) == 2

    def test_none_search_provider_does_not_raise(self):
        service = IntelligentExtractorService(search_provider=None, llm_provider=None)
        chunks = [
            {"category": "GPA", "information": "3.95 GPA", "source_file": "Transcript.pdf", "section": "education"},
        ]

        result = service.store_chunks_to_opensearch("user123", chunks, "Transcript.pdf")

        assert result == {"status": "ok", "stored_chunks": 0}

    def test_empty_chunks_list(self, service):
        result = service.store_chunks_to_opensearch("user123", [], "unknown")
        assert result == {"status": "ok", "stored_chunks": 0}

    def test_store_document_failure_not_counted(self, service, fake_search_provider):
        fake_search_provider.store_document.return_value = False
        chunks = [
            {"category": "GPA", "information": "3.95 GPA", "source_file": "Transcript.pdf", "section": "education"},
        ]

        result = service.store_chunks_to_opensearch("user123", chunks, "Transcript.pdf")

        assert result["status"] == "ok"
        assert result["stored_chunks"] == 0


class TestParseLlmJsonResponse:
    def test_parses_plain_json_array(self):
        result = IntelligentExtractorService._parse_llm_json_response(CANNED_LLM_JSON)
        assert isinstance(result, list)
        assert len(result) == 3

    def test_strips_markdown_code_fences(self):
        wrapped = f"```json\n{CANNED_LLM_JSON}\n```"
        result = IntelligentExtractorService._parse_llm_json_response(wrapped)
        assert isinstance(result, list)
        assert len(result) == 3

    def test_returns_none_for_garbage(self):
        result = IntelligentExtractorService._parse_llm_json_response("this is not json")
        assert result is None

    def test_returns_none_for_empty_string(self):
        result = IntelligentExtractorService._parse_llm_json_response("")
        assert result is None

    def test_handles_object_wrapped_array(self):
        wrapped = json.dumps({"chunks": json.loads(CANNED_LLM_JSON)})
        result = IntelligentExtractorService._parse_llm_json_response(wrapped)
        assert isinstance(result, list)
        assert len(result) == 3
