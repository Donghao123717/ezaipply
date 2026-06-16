"""
test_integration.py — Orchestrator end-to-end tests using:
  - Real PlaywrightTool(dry_run=True)  — no browser, no Facebook
  - Real MemoryTool (temp directory)
  - Mocked LLMClient               — no API calls

Catches wiring bugs in settings loading, agent construction, and job dispatch
that pure unit tests with fully-faked internals would miss.

Run: python3.12 -m pytest tests/test_integration.py -v
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture()
def patched_orch(monkeypatch, tmp_path):
    """
    Real Orchestrator with:
      - PlaywrightTool(dry_run=True) — from settings.yaml default
      - MemoryTool pointed at tmp_path
      - MockLLM that returns a canned caption / self-critique approval
    """
    from agents import orchestrator as orch_mod
    from tools.memory_tool import MemoryTool

    tmp_memory = MemoryTool(
        state_path=tmp_path / "state.json",
        comment_log_path=tmp_path / "comment_log.json",
    )

    class MockLLM:
        calls: list = []

        def __init__(self, provider=None, model=None):
            MockLLM.calls = []

        def chat(self, system, user):
            MockLLM.calls.append((system, user))
            if "quality reviewer" in system:
                return '{"approved": true, "feedback": ""}'
            return "CAPTION:\nIntegration test caption"

    monkeypatch.setattr(orch_mod, "LLMClient", MockLLM)
    monkeypatch.setattr(orch_mod, "MemoryTool", lambda: tmp_memory)

    orch = orch_mod.Orchestrator()
    # Zero follow delays so the test doesn't sleep between follows
    orch.follow_agent.delay_min = 0
    orch.follow_agent.delay_max = 0
    return orch, tmp_memory


class TestDryRunIntegration:
    def test_post_manual_prints_dry_run_block(self, patched_orch, tmp_path, capsys):
        orch, _ = patched_orch
        job = {
            "mode": "manual",
            "post": {"enabled": True, "media": "photo.jpg", "caption": "Hello world!"},
        }
        job_path = tmp_path / "job.yaml"
        job_path.write_text(yaml.safe_dump(job))

        summary = orch.run_job(str(job_path))
        out = capsys.readouterr().out

        assert summary["results"]["post"]["ok"] is True
        assert summary["results"]["post"]["caption"] == "Hello world!"
        assert "DRY-RUN" in out
        assert "Hello world!" in out

    def test_dm_manual_prints_dry_run_block(self, patched_orch, tmp_path, capsys):
        orch, _ = patched_orch
        job = {
            "mode": "manual",
            "dm": {
                "enabled": True,
                "recipients": [{"target": "alice", "text": "Hey Alice!"}],
            },
        }
        job_path = tmp_path / "job.yaml"
        job_path.write_text(yaml.safe_dump(job))

        summary = orch.run_job(str(job_path))
        out = capsys.readouterr().out

        assert summary["results"]["dm"]["ok"] is True
        assert summary["results"]["dm"]["sent"][0]["target"] == "alice"
        assert "DRY-RUN" in out
        assert "alice" in out

    def test_comment_manual_prints_dry_run_block(self, patched_orch, tmp_path, capsys):
        orch, _ = patched_orch
        post_url = "https://www.facebook.com/permalink/999/"
        job = {
            "mode": "manual",
            "comment": {"enabled": True, "post_url": post_url, "text": "Great post!"},
        }
        job_path = tmp_path / "job.yaml"
        job_path.write_text(yaml.safe_dump(job))

        summary = orch.run_job(str(job_path))
        out = capsys.readouterr().out

        assert summary["results"]["comment"]["ok"] is True
        assert "DRY-RUN" in out
        assert "Great post!" in out

    def test_follow_inline_prints_dry_run_block(self, patched_orch, tmp_path, capsys):
        orch, _ = patched_orch
        orch.follow_agent.min_per_day = 3
        orch.follow_agent.max_per_day = 3

        job = {
            "mode": "manual",
            "follow": {
                "enabled": True,
                "accounts": ["commonapp", "collegeboard", "nacac"],
            },
        }
        job_path = tmp_path / "job.yaml"
        job_path.write_text(yaml.safe_dump(job))

        with patch("random.sample", side_effect=lambda pop, k: pop[:k]):
            summary = orch.run_job(str(job_path))

        out = capsys.readouterr().out
        assert summary["results"]["follow"]["ok"] is True
        assert summary["results"]["follow"]["followed"] == 3
        assert summary["results"]["follow"]["friend_requested"] == 0
        assert "DRY-RUN" in out

    def test_llm_mode_post_calls_llm_and_uses_generated_caption(
        self, patched_orch, tmp_path, capsys
    ):
        from agents import orchestrator as orch_mod

        orch, _ = patched_orch
        job = {
            "mode": "llm",
            "post": {
                "enabled": True,
                "media": "photo.jpg",
                "post_format": "story",
                "extra_context": "college apps stress",
            },
        }
        job_path = tmp_path / "job.yaml"
        job_path.write_text(yaml.safe_dump(job))

        summary = orch.run_job(str(job_path))
        out = capsys.readouterr().out

        assert summary["results"]["post"]["ok"] is True
        assert "Integration test caption" in summary["results"]["post"]["caption"]
        assert "DRY-RUN" in out
        # LLM must have been called to generate the caption
        assert len(orch_mod.LLMClient.calls) >= 1

    def test_multi_action_job_executes_all_enabled_sections(
        self, patched_orch, tmp_path, capsys
    ):
        orch, _ = patched_orch
        job = {
            "mode": "manual",
            "post": {"enabled": True, "media": "photo.jpg", "caption": "Post caption"},
            "dm": {
                "enabled": True,
                "recipients": [{"target": "bob", "text": "Hi Bob!"}],
            },
            "comment": {
                "enabled": False,  # disabled — should not appear in results
                "post_url": "https://fb.com/p/1/",
                "text": "skipped",
            },
        }
        job_path = tmp_path / "job.yaml"
        job_path.write_text(yaml.safe_dump(job))

        summary = orch.run_job(str(job_path))

        assert "post" in summary["results"]
        assert "dm" in summary["results"]
        assert "comment" not in summary["results"]

    def test_invalid_mode_raises_value_error(self, patched_orch, tmp_path):
        orch, _ = patched_orch
        job = {"mode": "auto"}
        job_path = tmp_path / "job.yaml"
        job_path.write_text(yaml.safe_dump(job))

        with pytest.raises(ValueError, match="mode must be"):
            orch.run_job(str(job_path))

    def test_missing_job_file_raises_file_not_found(self, patched_orch):
        orch, _ = patched_orch
        with pytest.raises(FileNotFoundError):
            orch.run_job("/tmp/no_such_job_file_xyz.yaml")
