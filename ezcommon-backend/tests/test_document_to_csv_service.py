"""
Tests for services/document_to_csv_service.py

The service builds its own search provider internally in __init__. For unit
testing we simply construct the service (construction must never raise, even
without env vars configured) and then replace instance.search_provider with a
MagicMock whose get_all_chunks_for_user(...) returns canned chunk lists.
"""
import csv
import io
import os
import sys
from unittest.mock import MagicMock

import pytest

# Make sure the repo root is importable when running pytest from elsewhere
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.document_to_csv_service import DocumentToCSVService


SAMPLE_CHUNKS = [
    {
        "content": "Studied biology at Lincoln High School.",
        "category": "education",
        "chunk_index": 0,
        "source_file": "transcript.pdf",
        "section": "education",
        "file_type": "pdf",
    },
    {
        "content": "GPA: 3.9/4.0",
        "category": "education",
        "chunk_index": 1,
        "source_file": "transcript.pdf",
        "section": "education",
        "file_type": "pdf",
    },
    {
        "content": "Captain of the debate team for 3 years.",
        "category": "activities",
        "chunk_index": 0,
        "source_file": "resume.docx",
        "section": "activity",
        "file_type": "docx",
    },
    {
        "content": "SAT score: 1520",
        "category": "testing",
        "chunk_index": 0,
        "source_file": "scores.pdf",
        "section": "testing",
        "file_type": "pdf",
    },
]


@pytest.fixture
def service():
    """Construct a real DocumentToCSVService, then swap in a fake search provider."""
    svc = DocumentToCSVService()
    svc.search_provider = MagicMock()
    return svc


def test_construction_never_raises(monkeypatch):
    """Constructor must not raise even with no special env vars configured."""
    for var in [
        "SEARCH_PROVIDER", "OPENSEARCH_HOST", "OPENSEARCH_REGION",
        "OPENSEARCH_INDEX", "OPENSEARCH_PORT", "CHROMADB_DATA_DIR",
        "CHROMADB_COLLECTION_NAME",
    ]:
        monkeypatch.delenv(var, raising=False)

    svc = DocumentToCSVService()
    assert svc is not None
    # search_provider is either None (if init failed) or a provider instance;
    # either way, no exception should have propagated.


def test_get_statistics_aggregates_counts(service):
    service.search_provider.get_all_chunks_for_user.return_value = SAMPLE_CHUNKS

    stats = service.get_statistics("user-1", None)

    assert stats["user_id"] == "user-1"
    assert stats["section"] is None
    assert stats["total_chunks"] == 4
    # 3 distinct source files: transcript.pdf, resume.docx, scores.pdf
    assert stats["total_documents"] == 3
    assert stats["categories"] == {
        "education": 2,
        "activities": 1,
        "testing": 1,
    }
    assert stats["sections"] == {
        "education": 2,
        "activity": 1,
        "testing": 1,
    }

    service.search_provider.get_all_chunks_for_user.assert_called_once_with("user-1", None)


def test_get_statistics_empty(service):
    service.search_provider.get_all_chunks_for_user.return_value = []

    stats = service.get_statistics("user-empty")

    assert stats["total_documents"] == 0
    assert stats["total_chunks"] == 0
    assert stats["categories"] == {}
    assert stats["sections"] == {}


def test_generate_summary_csv_no_chunks_returns_error(service):
    service.search_provider.get_all_chunks_for_user.return_value = []

    result = service.generate_summary_csv("user-1", "education")

    assert result["status"] == "error"
    assert "message" in result


def test_generate_summary_csv_success(service):
    service.search_provider.get_all_chunks_for_user.return_value = SAMPLE_CHUNKS

    result = service.generate_summary_csv("user-1")

    assert result["status"] == "success"
    assert result["total_documents"] == 3
    assert result["total_chunks"] == 4
    assert "csv_content" in result

    reader = csv.reader(io.StringIO(result["csv_content"]))
    rows = list(reader)

    header = rows[0]
    assert header == ["source_file", "section", "category", "content"]

    data_rows = rows[1:]
    assert len(data_rows) == 4

    # Spot check one row's content made it through correctly
    contents = [row[3] for row in data_rows]
    assert "GPA: 3.9/4.0" in contents


def test_generate_categorized_csv_no_chunks_returns_error(service):
    service.search_provider.get_all_chunks_for_user.return_value = []

    result = service.generate_categorized_csv("user-1")

    assert result["status"] == "error"
    assert "message" in result


def test_generate_categorized_csv_success_and_grouping(service):
    service.search_provider.get_all_chunks_for_user.return_value = SAMPLE_CHUNKS

    result = service.generate_categorized_csv("user-1")

    assert result["status"] == "success"
    assert result["total_documents"] == 3
    assert result["total_categories"] == 3  # education, activities, testing
    assert "csv_content" in result

    reader = csv.reader(io.StringIO(result["csv_content"]))
    rows = list(reader)

    header = rows[0]
    assert header == ["category", "source_file", "section", "content"]

    data_rows = rows[1:]
    assert len(data_rows) == 4

    categories_in_order = [row[0] for row in data_rows]

    # All rows belonging to the same category must be contiguous (grouped together)
    seen = set()
    last_category = None
    for cat in categories_in_order:
        if cat != last_category:
            assert cat not in seen, f"Category {cat} is not contiguous in output"
            seen.add(cat)
            last_category = cat

    # Categories should appear sorted alphabetically: activities, education, testing
    assert categories_in_order == sorted(categories_in_order)
    assert set(categories_in_order) == {"education", "activities", "testing"}


def test_generate_summary_csv_respects_section_filter(service):
    service.search_provider.get_all_chunks_for_user.return_value = [SAMPLE_CHUNKS[0]]

    result = service.generate_summary_csv("user-1", "education")

    service.search_provider.get_all_chunks_for_user.assert_called_once_with("user-1", "education")
    assert result["status"] == "success"
    assert result["total_chunks"] == 1
    assert result["total_documents"] == 1


def test_methods_handle_missing_search_provider_gracefully():
    svc = DocumentToCSVService()
    svc.search_provider = None

    stats = svc.get_statistics("user-1")
    assert stats["total_chunks"] == 0
    assert stats["total_documents"] == 0

    summary = svc.generate_summary_csv("user-1")
    assert summary["status"] == "error"

    categorized = svc.generate_categorized_csv("user-1")
    assert categorized["status"] == "error"
