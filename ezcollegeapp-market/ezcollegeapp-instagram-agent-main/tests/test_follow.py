from __future__ import annotations

import argparse
from unittest.mock import MagicMock, patch

import pytest
import yaml


# ---------------------------------------------------------------------------
# InstagrapiTool.follow_user dry-run
# ---------------------------------------------------------------------------

class TestInstagrapiToolFollowDryRun:
    def test_follow_user_dry_run_prints_and_returns_true(self, capsys):
        from tools.instagrapi_tool import InstagrapiTool

        tool = InstagrapiTool(dry_run=True)
        result = tool.follow_user("target_user")
        out = capsys.readouterr().out

        assert result is True
        assert "DRY-RUN" in out
        assert "target_user" in out

    def test_follow_user_dry_run_does_not_write_memory(self, tmp_memory_dir, capsys):
        from agents.follow_agent import FollowAgent
        from tools.instagrapi_tool import InstagrapiTool

        tool = InstagrapiTool(dry_run=True)
        agent = FollowAgent(instagrapi=tool, memory=tmp_memory_dir,
                            min_per_day=1, max_per_day=1, delay_min=0, delay_max=0)
        agent.follow_batch(["dry_user"])

        assert tmp_memory_dir.has_followed("dry_user") is False
        assert tmp_memory_dir.daily_follow_count() == 0


# ---------------------------------------------------------------------------
# MemoryTool follow tracking
# ---------------------------------------------------------------------------

class TestMemoryToolFollow:
    def test_has_followed_returns_false_initially(self, tmp_memory_dir):
        assert tmp_memory_dir.has_followed("new_user") is False

    def test_mark_followed_records_username(self, tmp_memory_dir):
        tmp_memory_dir.mark_followed("user_a")
        assert tmp_memory_dir.has_followed("user_a") is True

    def test_mark_followed_does_not_duplicate(self, tmp_memory_dir):
        tmp_memory_dir.mark_followed("user_b")
        tmp_memory_dir.mark_followed("user_b")
        state = tmp_memory_dir.load_state()
        assert state["followed_usernames"].count("user_b") == 1

    def test_mark_followed_increments_daily_count(self, tmp_memory_dir):
        tmp_memory_dir.mark_followed("user_c")
        tmp_memory_dir.mark_followed("user_d")
        assert tmp_memory_dir.daily_follow_count() == 2

    def test_daily_follow_count_resets_on_new_day(self, tmp_memory_dir):
        tmp_memory_dir.mark_followed("user_e")
        assert tmp_memory_dir.daily_follow_count() == 1

        state = tmp_memory_dir.load_state()
        state["last_reset_date"] = "2000-01-01"
        tmp_memory_dir.save_state(state)

        assert tmp_memory_dir.daily_follow_count() == 0


# ---------------------------------------------------------------------------
# FollowAgent
# ---------------------------------------------------------------------------

class TestFollowAgent:
    def _make_agent(self, tmp_memory_dir, min_per_day=2, max_per_day=4,
                    delay_min=0, delay_max=0, active_hours=None):
        from agents.follow_agent import FollowAgent

        instagrapi = MagicMock()
        instagrapi.follow_user.return_value = True
        instagrapi.dry_run = False
        agent = FollowAgent(
            instagrapi=instagrapi,
            memory=tmp_memory_dir,
            min_per_day=min_per_day,
            max_per_day=max_per_day,
            delay_min=delay_min,
            delay_max=delay_max,
            active_hours=active_hours,
        )
        return agent, instagrapi

    def test_follow_batch_follows_accounts(self, tmp_memory_dir):
        agent, instagrapi = self._make_agent(tmp_memory_dir, min_per_day=3, max_per_day=3)

        count = agent.follow_batch(["a", "b", "c"])

        assert count == 3
        assert instagrapi.follow_user.call_count == 3

    def test_follow_batch_skips_already_followed(self, tmp_memory_dir):
        tmp_memory_dir.mark_followed("existing")
        agent, instagrapi = self._make_agent(tmp_memory_dir, min_per_day=2, max_per_day=2)

        agent.follow_batch(["existing", "new_one", "new_two"])

        for call in instagrapi.follow_user.call_args_list:
            assert call.args[0] != "existing"

    def test_follow_batch_returns_zero_when_all_followed(self, tmp_memory_dir):
        for u in ["x", "y", "z"]:
            tmp_memory_dir.mark_followed(u)
        agent, instagrapi = self._make_agent(tmp_memory_dir)

        count = agent.follow_batch(["x", "y", "z"])

        assert count == 0
        instagrapi.follow_user.assert_not_called()

    def test_follow_batch_respects_daily_cap(self, tmp_memory_dir):
        agent, instagrapi = self._make_agent(tmp_memory_dir, min_per_day=2, max_per_day=3)
        for i in range(3):
            tmp_memory_dir.mark_followed(f"pre_{i}")

        count = agent.follow_batch(["new_a", "new_b"])

        assert count == 0
        instagrapi.follow_user.assert_not_called()

    def test_follow_batch_records_in_memory(self, tmp_memory_dir):
        agent, _ = self._make_agent(tmp_memory_dir, min_per_day=2, max_per_day=2)

        with patch("random.sample", side_effect=lambda pop, k: pop[:k]):
            agent.follow_batch(["user1", "user2", "user3"])

        assert tmp_memory_dir.has_followed("user1")
        assert tmp_memory_dir.has_followed("user2")

    def test_follow_batch_logs_entry(self, tmp_memory_dir):
        agent, _ = self._make_agent(tmp_memory_dir, min_per_day=1, max_per_day=1)

        with patch("random.sample", side_effect=lambda pop, k: pop[:k]):
            agent.follow_batch(["log_user"])

        log = tmp_memory_dir.load_comment_log()
        assert any(e["type"] == "follow" and e["username"] == "log_user" for e in log)

    def test_follow_batch_skips_outside_active_hours(self, tmp_memory_dir):
        agent, instagrapi = self._make_agent(tmp_memory_dir, active_hours=(9, 17))

        with patch("agents.follow_agent.datetime") as mock_dt:
            mock_dt.now.return_value.hour = 3
            count = agent.follow_batch(["anyone"])

        assert count == 0
        instagrapi.follow_user.assert_not_called()

    def test_follow_batch_runs_inside_active_hours(self, tmp_memory_dir):
        agent, instagrapi = self._make_agent(
            tmp_memory_dir, min_per_day=1, max_per_day=1, active_hours=(9, 17)
        )

        with patch("agents.follow_agent.datetime") as mock_dt:
            mock_dt.now.return_value.hour = 12
            mock_dt.now.return_value.isoformat.return_value = "2026-05-12T12:00:00+00:00"
            count = agent.follow_batch(["inside_user"])

        assert count == 1

    def test_follow_batch_partial_budget(self, tmp_memory_dir):
        """Follows only remaining budget even when min_per_day is higher."""
        agent, instagrapi = self._make_agent(tmp_memory_dir, min_per_day=3, max_per_day=5)
        for i in range(4):
            tmp_memory_dir.mark_followed(f"pre_{i}")

        with patch("random.sample", side_effect=lambda pop, k: pop[:k]):
            count = agent.follow_batch(["new_1", "new_2", "new_3"])

        assert count == 1
        assert instagrapi.follow_user.call_count == 1


# ---------------------------------------------------------------------------
# CLI cmd_follow
# ---------------------------------------------------------------------------

class TestCLIFollow:
    def test_cmd_follow_prints_count(self, monkeypatch, capsys, tmp_path):
        import main as cli

        class FakeOrch:
            def follow_batch(self, usernames):
                return len(usernames)

        monkeypatch.setattr(cli, "_orch", lambda: FakeOrch())

        accounts_file = tmp_path / "accounts.yaml"
        accounts_file.write_text(yaml.safe_dump({"accounts": ["u1", "u2", "u3"]}))

        cli.cmd_follow(argparse.Namespace(accounts_file=str(accounts_file)))

        out = capsys.readouterr().out
        assert "Followed 3 account(s)" in out
