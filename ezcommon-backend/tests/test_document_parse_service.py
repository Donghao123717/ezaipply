"""
Tests for services/document_parse_service.py

Uses fake search_provider / llm_provider stubs and monkeypatches the
service's own S3 download helper (_download_from_s3) so no real network,
boto3, or moto calls are needed.
"""
import json
import os
import sys

import pytest

# Make sure the repo root is importable when running pytest from elsewhere
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.document_parse_service import DocumentParseService


class FakeSearchProvider:
    """Minimal fake implementing the SearchProvider surface this service needs."""

    def __init__(self, store_success=True):
        self.initialized = False
        self.init_calls = 0
        self.store_success = store_success
        self.stored_documents = []

    def initialize(self):
        self.initialized = True
        self.init_calls += 1

    def store_document(self, document_id, document):
        self.stored_documents.append((document_id, document))
        return self.store_success


class FakeLLMProvider:
    """Minimal fake implementing chat_completion() used by the service."""

    def __init__(self, content=None, raise_error=False):
        self._content = content
        self._raise_error = raise_error
        self.calls = []

    def chat_completion(self, messages, temperature=0.0, max_tokens=None):
        self.calls.append({
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        })
        if self._raise_error:
            raise RuntimeError("simulated LLM failure")
        return {"content": self._content}


SEMANTIC_BLOCKS_RESPONSE = """---BLOCK_START---
BLOCK_TYPE: ACADEMIC_PERFORMANCE
SUMMARY: GPA and school info
SOURCES: transcript.pdf
PRIORITY: high
CONTAINS_PERSONAL_DATA: false
CONTENT:
Student has a 4.0 GPA at Test High School.
---BLOCK_END---
"""


# ---------------------------------------------------------------------------
# Constructor
# ---------------------------------------------------------------------------

def test_constructor_initializes_search_provider():
    fake_search = FakeSearchProvider()
    service = DocumentParseService(search_provider=fake_search, llm_provider=None)

    assert fake_search.initialized is True
    assert fake_search.init_calls == 1
    assert service.search_provider is fake_search


def test_constructor_handles_none_search_provider():
    # Should not raise
    service = DocumentParseService(search_provider=None, llm_provider=None)
    assert service.search_provider is None


def test_constructor_idempotent_initialize_is_safe():
    fake_search = FakeSearchProvider()
    fake_search.initialize()  # simulate caller already having initialized it (workflow script)
    service = DocumentParseService(search_provider=fake_search, llm_provider=None)

    # Called twice total, no error
    assert fake_search.init_calls == 2
    assert fake_search.initialized is True


def test_constructor_survives_initialize_exception():
    class ExplodingSearchProvider(FakeSearchProvider):
        def initialize(self):
            raise RuntimeError("boom")

    # Should not raise, just log a warning
    service = DocumentParseService(search_provider=ExplodingSearchProvider(), llm_provider=None)
    assert service.search_provider is not None


# ---------------------------------------------------------------------------
# _generate_document_id
# ---------------------------------------------------------------------------

def test_generate_document_id_shape_and_uniqueness():
    service = DocumentParseService()
    doc_id_1 = service._generate_document_id("transcript.pdf", "user123")

    assert doc_id_1.startswith("doc_user123_transcript.pdf_")
    assert isinstance(doc_id_1, str)

    # Sanitizes unsafe characters
    doc_id_2 = service._generate_document_id("my file @#.pdf", "user/123")
    assert "/" not in doc_id_2
    assert "@" not in doc_id_2
    assert "#" not in doc_id_2
    assert " " not in doc_id_2


def test_generate_document_id_uniqueness_across_calls(monkeypatch):
    service = DocumentParseService()

    times = iter([1000, 1001])
    monkeypatch.setattr(
        "services.document_parse_service.time.time", lambda: next(times)
    )

    id_a = service._generate_document_id("a.pdf", "user1")
    id_b = service._generate_document_id("a.pdf", "user1")
    assert id_a != id_b


# ---------------------------------------------------------------------------
# _create_text_chunks
# ---------------------------------------------------------------------------

def test_create_text_chunks_empty_text_returns_empty_list():
    service = DocumentParseService()
    assert service._create_text_chunks("", source_file="f.txt") == []
    assert service._create_text_chunks("   ", source_file="f.txt") == []


def test_create_text_chunks_short_text_single_chunk():
    service = DocumentParseService()
    text = "This is a short paragraph of text."
    chunks = service._create_text_chunks(text, source_file="f.txt")

    assert len(chunks) == 1
    assert chunks[0]["content"] == text
    assert chunks[0]["text"] == text
    assert chunks[0]["category"] == "general"
    assert chunks[0]["source_file"] == "f.txt"


def test_create_text_chunks_splits_long_text():
    service = DocumentParseService()
    # Build several paragraphs that together exceed the chunk max size
    paragraph = "Lorem ipsum dolor sit amet consectetur adipiscing elit. " * 20  # ~1160 chars
    text = "\n\n".join([paragraph] * 5)  # ~5800 chars total

    chunks = service._create_text_chunks(text, source_file="doc.txt")

    assert len(chunks) > 1
    for chunk in chunks:
        assert set(chunk.keys()) == {"content", "text", "category", "source_file"}
        assert chunk["content"] == chunk["text"]
        assert chunk["source_file"] == "doc.txt"
        # No chunk should be wildly larger than the max target (allow some slack)
        assert len(chunk["content"]) <= 2100


def test_create_text_chunks_hard_splits_oversized_single_paragraph():
    service = DocumentParseService()
    huge_paragraph = "x" * 5000  # single paragraph, no blank-line breaks

    chunks = service._create_text_chunks(huge_paragraph, source_file="big.txt")

    assert len(chunks) >= 3
    rebuilt = "".join(c["content"] for c in chunks)
    assert rebuilt == huge_paragraph


# ---------------------------------------------------------------------------
# _store_document_chunks
# ---------------------------------------------------------------------------

def test_store_document_chunks_calls_store_document_with_expected_shape():
    fake_search = FakeSearchProvider(store_success=True)
    service = DocumentParseService(search_provider=fake_search, llm_provider=None)

    chunks = [{"content": "hello", "text": "hello", "category": "general"}]
    result = service._store_document_chunks(
        document_id="doc_1",
        source_file="f.pdf",
        chunks=chunks,
        processor_name="PyPDF2+GPT",
        file_type="pdf",
        user_id="user1",
        section="education",
    )

    assert result is True
    assert len(fake_search.stored_documents) == 1
    stored_id, stored_doc = fake_search.stored_documents[0]
    assert stored_id == "doc_1"
    assert stored_doc["user_id"] == "user1"
    assert stored_doc["source_file"] == "f.pdf"
    assert stored_doc["section"] == "education"
    assert stored_doc["file_type"] == "pdf"
    assert stored_doc["information_chunks"] == chunks


def test_store_document_chunks_returns_false_when_no_search_provider():
    service = DocumentParseService(search_provider=None, llm_provider=None)
    result = service._store_document_chunks(
        document_id="doc_1",
        source_file="f.pdf",
        chunks=[{"content": "x", "text": "x", "category": "general"}],
        processor_name="PyPDF2+GPT",
        file_type="pdf",
        user_id="user1",
        section="education",
    )
    assert result is False


def test_store_document_chunks_returns_false_on_store_failure():
    fake_search = FakeSearchProvider(store_success=False)
    service = DocumentParseService(search_provider=fake_search, llm_provider=None)

    result = service._store_document_chunks(
        document_id="doc_1",
        source_file="f.pdf",
        chunks=[{"content": "x", "text": "x", "category": "general"}],
        processor_name="PyPDF2+GPT",
        file_type="pdf",
        user_id="user1",
        section="education",
    )
    assert result is False


# ---------------------------------------------------------------------------
# _parse_s3_key
# ---------------------------------------------------------------------------

def test_parse_s3_key_standard_shape():
    service = DocumentParseService()
    info = service._parse_s3_key("user-uploads/user123/education/transcript.pdf")
    assert info == {"section": "education", "filename": "transcript.pdf"}


def test_parse_s3_key_raises_on_empty():
    service = DocumentParseService()
    with pytest.raises(ValueError):
        service._parse_s3_key("")


def test_parse_s3_key_raises_on_malformed():
    service = DocumentParseService()
    with pytest.raises(ValueError):
        service._parse_s3_key("justafilename.pdf")


# ---------------------------------------------------------------------------
# process_file_from_s3 (end-to-end, everything mocked)
# ---------------------------------------------------------------------------

def test_process_file_from_s3_bad_key_raises_value_error():
    service = DocumentParseService()
    with pytest.raises(ValueError):
        service.process_file_from_s3("", "user123")


def test_process_file_from_s3_text_file_with_progress_callback(monkeypatch):
    fake_search = FakeSearchProvider(store_success=True)
    fake_llm = FakeLLMProvider(content=SEMANTIC_BLOCKS_RESPONSE)
    service = DocumentParseService(search_provider=fake_search, llm_provider=fake_llm)

    monkeypatch.setattr(
        service, "_download_from_s3", lambda s3_key: b"Hello, this is plain text content."
    )

    progress_events = []

    def progress_callback(progress, message):
        progress_events.append((progress, message))

    result = service.process_file_from_s3(
        "user-uploads/user123/general/notes.txt",
        "user123",
        progress_callback=progress_callback,
    )

    # Progress callback was called multiple times, monotonically increasing
    assert len(progress_events) >= 4
    progresses = [p for p, _ in progress_events]
    assert progresses == sorted(progresses)
    assert progresses[0] == 10
    assert progresses[-1] == 100

    # Result shape
    assert result["status"] == "success"
    assert isinstance(result["document_id"], str) and result["document_id"]
    assert result["source_file"] == "notes.txt"
    assert result["s3_key"] == "user-uploads/user123/general/notes.txt"
    assert result["section"] == "general"
    assert result["file_type"] == "txt"
    assert isinstance(result["chunks_created"], int) and result["chunks_created"] > 0
    assert isinstance(result["chunks"], list)
    for chunk in result["chunks"]:
        assert "text" in chunk
        assert "category" in chunk
        assert "chunk_type" in chunk
    assert result["processor_used"] == "TextReader"
    assert result["opensearch_stored"] is True

    # Storage actually happened
    assert len(fake_search.stored_documents) == 1


def test_process_file_from_s3_without_progress_callback_does_not_break(monkeypatch):
    fake_search = FakeSearchProvider(store_success=True)
    fake_llm = FakeLLMProvider(content=SEMANTIC_BLOCKS_RESPONSE)
    service = DocumentParseService(search_provider=fake_search, llm_provider=fake_llm)

    monkeypatch.setattr(
        service, "_download_from_s3", lambda s3_key: b"Some plain text content here."
    )

    result = service.process_file_from_s3(
        "user-uploads/user123/general/notes.txt",
        "user123",
        progress_callback=None,
    )

    assert result["status"] == "success"
    assert result["chunks_created"] > 0


def test_process_file_from_s3_falls_back_to_naive_chunks_on_semantic_failure(monkeypatch):
    fake_search = FakeSearchProvider(store_success=True)
    # LLM raises -> semantic chunk formation should fail and fall back
    fake_llm = FakeLLMProvider(raise_error=True)
    service = DocumentParseService(search_provider=fake_search, llm_provider=fake_llm)

    monkeypatch.setattr(
        service, "_download_from_s3", lambda s3_key: b"Some plain text content for fallback chunking."
    )

    result = service.process_file_from_s3(
        "user-uploads/user123/general/notes.txt",
        "user123",
    )

    assert result["status"] == "success"
    assert result["chunks_created"] > 0
    # Fallback naive chunks use category "general"
    assert all(c["category"] == "general" for c in result["chunks"])


def test_process_file_from_s3_pdf_dispatches_to_process_pdf(monkeypatch):
    fake_search = FakeSearchProvider(store_success=True)
    fake_llm = FakeLLMProvider(content=SEMANTIC_BLOCKS_RESPONSE)
    service = DocumentParseService(search_provider=fake_search, llm_provider=fake_llm)

    monkeypatch.setattr(service, "_download_from_s3", lambda s3_key: b"%PDF-1.4 fake pdf bytes")
    monkeypatch.setattr(service, "process_pdf", lambda path: "Extracted PDF text content.")

    result = service.process_file_from_s3(
        "user-uploads/user123/education/transcript.pdf",
        "user123",
    )

    assert result["status"] == "success"
    assert result["file_type"] == "pdf"
    assert result["processor_used"] == "PyPDF2+GPT"
    assert result["section"] == "education"


def test_process_file_from_s3_image_dispatches_to_process_image(monkeypatch):
    fake_search = FakeSearchProvider(store_success=True)
    fake_llm = FakeLLMProvider(content=SEMANTIC_BLOCKS_RESPONSE)
    service = DocumentParseService(search_provider=fake_search, llm_provider=fake_llm)

    monkeypatch.setattr(service, "_download_from_s3", lambda s3_key: b"fake image bytes")
    monkeypatch.setattr(
        service, "process_image", lambda path, source_file: {"name": "Jane Doe", "gpa": "4.0"}
    )

    result = service.process_file_from_s3(
        "user-uploads/user123/education/id_card.png",
        "user123",
    )

    assert result["status"] == "success"
    assert result["file_type"] == "png"
    assert result["processor_used"] == "VisionGPT"


def test_process_file_from_s3_no_search_provider_reports_opensearch_stored_false(monkeypatch):
    fake_llm = FakeLLMProvider(content=SEMANTIC_BLOCKS_RESPONSE)
    service = DocumentParseService(search_provider=None, llm_provider=fake_llm)

    monkeypatch.setattr(service, "_download_from_s3", lambda s3_key: b"Plain text content.")

    result = service.process_file_from_s3(
        "user-uploads/user123/general/notes.txt",
        "user123",
    )

    assert result["status"] == "success"
    assert result["opensearch_stored"] is False


# ---------------------------------------------------------------------------
# process_image / _parse_json_response defensiveness
# ---------------------------------------------------------------------------

def test_process_image_parses_clean_json(tmp_path):
    fake_llm = FakeLLMProvider(content='{"name": "Jane Doe", "gpa": "4.0"}')
    service = DocumentParseService(search_provider=None, llm_provider=fake_llm)

    img_path = tmp_path / "id.png"
    img_path.write_bytes(b"\x89PNG\r\n\x1a\nfake")

    result = service.process_image(str(img_path), source_file="id.png")
    assert result == {"name": "Jane Doe", "gpa": "4.0"}
    assert len(fake_llm.calls) == 1


def test_process_image_strips_markdown_code_fences(tmp_path):
    fenced = '```json\n{"name": "Jane Doe"}\n```'
    fake_llm = FakeLLMProvider(content=fenced)
    service = DocumentParseService(search_provider=None, llm_provider=fake_llm)

    img_path = tmp_path / "id.jpg"
    img_path.write_bytes(b"\xff\xd8\xff\xe0fake")

    result = service.process_image(str(img_path), source_file="id.jpg")
    assert result == {"name": "Jane Doe"}


def test_process_image_raises_without_llm_provider(tmp_path):
    service = DocumentParseService(search_provider=None, llm_provider=None)
    img_path = tmp_path / "id.png"
    img_path.write_bytes(b"fake")

    with pytest.raises(RuntimeError):
        service.process_image(str(img_path), source_file="id.png")


# ---------------------------------------------------------------------------
# form_semantic_chunks_for_user (thin wrapper)
# ---------------------------------------------------------------------------

def test_form_semantic_chunks_for_user_delegates_to_semantic_chunk_former():
    fake_llm = FakeLLMProvider(content=SEMANTIC_BLOCKS_RESPONSE)
    service = DocumentParseService(search_provider=None, llm_provider=fake_llm)

    raw_texts = [{"source_file": "t.pdf", "file_type": "pdf", "content": "Some GPA info"}]
    blocks = service.form_semantic_chunks_for_user("user1", "education", raw_texts)

    assert isinstance(blocks, list)
    assert len(blocks) == 1
    assert blocks[0]["content"] == "Student has a 4.0 GPA at Test High School."
    assert len(fake_llm.calls) == 1
