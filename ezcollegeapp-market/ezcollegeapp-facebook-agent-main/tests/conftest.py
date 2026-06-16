"""
tests/conftest.py — shared fixtures for Facebook agent tests.
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))

load_dotenv(Path(__file__).parent.parent / ".env")


@pytest.fixture()
def tmp_memory_dir(tmp_path):
    """Return a MemoryTool backed by a temporary directory."""
    from tools.memory_tool import MemoryTool

    return MemoryTool(
        state_path=tmp_path / "state.json",
        comment_log_path=tmp_path / "comment_log.json",
    )


@pytest.fixture()
def mock_playwright_live():
    """A PlaywrightTool mock with dry_run=False — simulates live browser calls."""
    pw = MagicMock()
    pw.dry_run = False
    pw.follow_user.return_value = "followed"
    pw.publish_post.return_value = "fb_post_id"
    pw.send_dm.return_value = "thread_1"
    pw.post_comment.return_value = "comment_id_1"
    pw.reply_to_comment.return_value = "reply_id_1"
    pw.get_comments.return_value = []
    return pw


@pytest.fixture()
def mock_llm():
    """LLMClient that returns a canned approved comment."""
    llm = MagicMock()
    llm.chat.return_value = (
        "I went through the exact same thing last year. "
        "Start your school list early — it really helps narrow things down. "
        "Good luck! 🎓"
    )
    return llm


@pytest.fixture()
def mock_llm_with_critique():
    """LLMClient that generates a comment AND approves it in self-critique."""
    llm = MagicMock()

    def side_effect(system, user):
        if "quality reviewer" in system:
            return '{"approved": true, "feedback": ""}'
        return (
            "I was in the exact same spot last year. "
            "Starting the school list early really helped me. "
            "I used EZCollegeApp to get personalised recommendations — saved a lot of time. "
            "Good luck! 🎓"
        )

    llm.chat.side_effect = side_effect
    return llm
