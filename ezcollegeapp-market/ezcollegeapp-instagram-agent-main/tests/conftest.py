"""
tests/conftest.py — shared fixtures for all Instagram agent test layers.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# ---------------------------------------------------------------------------
# Make the instagram_agent root importable without installing as a package
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).parent.parent))

FIXTURE_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def print_test_banner(request):
    """Print the currently running test and a short description (if available)."""
    nodeid = request.node.nodeid
    test_func = getattr(request.node, "function", None)
    doc = (getattr(test_func, "__doc__", "") or "").strip()
    summary = doc.splitlines()[0] if doc else ""

    print(f"\n[TEST] {nodeid}")
    if summary:
        print(f"[INFO] {summary}")


# ---------------------------------------------------------------------------
# Shared fixture data
# ---------------------------------------------------------------------------

@pytest.fixture()
def media_relevant():
    return json.loads((FIXTURE_DIR / "media_relevant.json").read_text())


@pytest.fixture()
def media_irrelevant():
    return json.loads((FIXTURE_DIR / "media_irrelevant.json").read_text())


@pytest.fixture()
def media_already_commented():
    return json.loads((FIXTURE_DIR / "media_already_commented.json").read_text())


# ---------------------------------------------------------------------------
# Temp memory directory (isolates tests from real memory/state.json)
# ---------------------------------------------------------------------------

@pytest.fixture()
def tmp_memory_dir(tmp_path):
    """Return a MemoryTool backed by a temporary directory."""
    from tools.memory_tool import MemoryTool

    state_path = tmp_path / "state.json"
    comment_log_path = tmp_path / "comment_log.json"
    return MemoryTool(state_path=state_path, comment_log_path=comment_log_path)


# ---------------------------------------------------------------------------
# Mock LLMClient fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_llm():
    """LLMClient returning a generic canned IG comment."""
    llm = MagicMock()
    llm.chat.return_value = (
        "That feeling when you finally hit submit 🎉 "
        "I remember going through the same thing — just take it one app at a time. "
        "EZCollegeApp (ezcollegeapp.com) helped me keep everything organized. Good luck! 🍀"
    )
    return llm


@pytest.fixture()
def mock_llm_relevant():
    """LLMClient whose relevance check always returns relevant=True."""
    llm = MagicMock()
    llm.chat.return_value = (
        '{"relevant": true, "reason": "Post is about college application stress."}'
    )
    return llm


@pytest.fixture()
def mock_llm_irrelevant():
    """LLMClient whose relevance check always returns relevant=False."""
    llm = MagicMock()
    llm.chat.return_value = (
        '{"relevant": false, "reason": "Post is about pizza, not college apps."}'
    )
    return llm


@pytest.fixture()
def mock_llm_approved_comment():
    """LLMClient that generates a comment AND approves it in self-critique."""
    llm = MagicMock()

    def side_effect(system, user):
        if "quality reviewer" in system:
            return '{"approved": true, "feedback": ""}'
        return (
            "I was in the exact same spot last year 😅 "
            "Start with your reach, match, and safety schools — that really helped me clarify my list. "
            "I also used EZCollegeApp to get a personalised school rec — saved me tons of time. "
            "Good luck, you've got this! 🎓"
        )

    llm.chat.side_effect = side_effect
    return llm


@pytest.fixture()
def mock_llm_post():
    """LLMClient that returns a valid CAPTION: format response."""
    llm = MagicMock()
    llm.chat.return_value = (
        "CAPTION:\n"
        "Submitting 12 college apps was the hardest thing I've done in high school 😤\n\n"
        "Here's what actually helped me survive the process ↓\n\n"
        "1️⃣ Start your essays way earlier than you think\n"
        "2️⃣ Keep a spreadsheet of deadlines\n"
        "3️⃣ EZCollegeApp autofilled all my Common App forms — saved me hours\n\n"
        "What's the hardest part of applying for you? Drop it below 👇\n\n"
        "#collegeapps #commonapp #collegeessay #applyingtocollege #collegebound\n"
        "#highschoolsenior #collegeprep #admissions #collegelife"
    )
    return llm
