"""
test_memory.py — unit tests for MemoryTool.

No mocks, no LLM, no browser required.
Run: python3.12 -m pytest tests/test_memory.py -v
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


# Uses `tmp_memory_dir` fixture from conftest.py (MemoryTool backed by tmp_path).


class TestFreshState:
    def test_all_daily_counters_start_at_zero(self, tmp_memory_dir):
        assert tmp_memory_dir.daily_comment_count() == 0
        assert tmp_memory_dir.daily_post_count() == 0
        assert tmp_memory_dir.daily_follow_count() == 0

    def test_nothing_commented_on_fresh_state(self, tmp_memory_dir):
        assert tmp_memory_dir.has_commented("https://fb.com/p/1/") is False

    def test_nothing_followed_on_fresh_state(self, tmp_memory_dir):
        assert tmp_memory_dir.has_followed("commonapp") is False

    def test_nothing_replied_on_fresh_state(self, tmp_memory_dir):
        assert tmp_memory_dir.has_replied_to_comment("cid_abc") is False

    def test_empty_comment_log_on_fresh_state(self, tmp_memory_dir):
        assert tmp_memory_dir.load_comment_log() == []


class TestMarkAndHas:
    def test_mark_commented_and_has_commented(self, tmp_memory_dir):
        tmp_memory_dir.mark_commented("https://fb.com/p/1/")
        assert tmp_memory_dir.has_commented("https://fb.com/p/1/") is True

    def test_mark_commented_increments_daily_count(self, tmp_memory_dir):
        tmp_memory_dir.mark_commented("url_a")
        tmp_memory_dir.mark_commented("url_b")
        assert tmp_memory_dir.daily_comment_count() == 2

    def test_mark_commented_same_url_twice_does_not_duplicate_in_list(self, tmp_memory_dir):
        tmp_memory_dir.mark_commented("url_a")
        tmp_memory_dir.mark_commented("url_a")
        state = tmp_memory_dir.load_state()
        assert state["commented_media_ids"].count("url_a") == 1
        assert tmp_memory_dir.daily_comment_count() == 2  # counter still increments both times

    def test_unknown_url_not_in_commented(self, tmp_memory_dir):
        tmp_memory_dir.mark_commented("url_a")
        assert tmp_memory_dir.has_commented("url_b") is False

    def test_mark_followed_and_has_followed(self, tmp_memory_dir):
        tmp_memory_dir.mark_followed("commonapp")
        assert tmp_memory_dir.has_followed("commonapp") is True

    def test_mark_followed_dedup_in_list_but_count_still_increments(self, tmp_memory_dir):
        tmp_memory_dir.mark_followed("commonapp")
        tmp_memory_dir.mark_followed("commonapp")
        state = tmp_memory_dir.load_state()
        assert state["followed_usernames"].count("commonapp") == 1
        assert tmp_memory_dir.daily_follow_count() == 2

    def test_mark_replied_and_has_replied(self, tmp_memory_dir):
        tmp_memory_dir.mark_replied_to_comment("cid_xyz")
        assert tmp_memory_dir.has_replied_to_comment("cid_xyz") is True

    def test_unknown_comment_id_not_in_replied(self, tmp_memory_dir):
        tmp_memory_dir.mark_replied_to_comment("cid_xyz")
        assert tmp_memory_dir.has_replied_to_comment("cid_other") is False

    def test_increment_post_count(self, tmp_memory_dir):
        tmp_memory_dir.increment_post_count()
        tmp_memory_dir.increment_post_count()
        assert tmp_memory_dir.daily_post_count() == 2


class TestCommentLog:
    def test_log_entry_appended_in_order(self, tmp_memory_dir):
        tmp_memory_dir.log_entry({"type": "comment", "post_url": "https://fb.com/p/1/", "text": "hi"})
        tmp_memory_dir.log_entry({"type": "dm", "target": "alice", "text": "hello"})
        log = tmp_memory_dir.load_comment_log()
        assert len(log) == 2
        assert log[0]["type"] == "comment"
        assert log[1]["target"] == "alice"

    def test_log_entry_timestamp_added_automatically(self, tmp_memory_dir):
        tmp_memory_dir.log_entry({"type": "post", "caption": "test"})
        log = tmp_memory_dir.load_comment_log()
        assert "timestamp" in log[0]

    def test_log_entry_explicit_timestamp_not_overwritten(self, tmp_memory_dir):
        tmp_memory_dir.log_entry({"type": "post", "timestamp": "2026-01-01T00:00:00+00:00"})
        log = tmp_memory_dir.load_comment_log()
        assert log[0]["timestamp"] == "2026-01-01T00:00:00+00:00"


class TestPersistence:
    def test_state_persists_across_instances(self, tmp_path):
        from tools.memory_tool import MemoryTool

        path = tmp_path / "state.json"
        log_path = tmp_path / "log.json"

        m1 = MemoryTool(state_path=path, comment_log_path=log_path)
        m1.mark_followed("page_a")
        m1.mark_commented("url_1")

        m2 = MemoryTool(state_path=path, comment_log_path=log_path)
        assert m2.has_followed("page_a") is True
        assert m2.has_commented("url_1") is True
        assert m2.daily_follow_count() == 1
        assert m2.daily_comment_count() == 1

    def test_corrupt_state_json_falls_back_to_default(self, tmp_path):
        from tools.memory_tool import MemoryTool

        path = tmp_path / "state.json"
        path.write_text("INVALID_JSON {{{")

        mem = MemoryTool(state_path=path, comment_log_path=tmp_path / "log.json")
        assert mem.daily_comment_count() == 0
        assert mem.has_commented("anything") is False

    def test_missing_state_file_uses_default(self, tmp_path):
        from tools.memory_tool import MemoryTool

        mem = MemoryTool(
            state_path=tmp_path / "nonexistent.json",
            comment_log_path=tmp_path / "log.json",
        )
        assert mem.daily_post_count() == 0
        assert mem.load_comment_log() == []


class TestDailyReset:
    def test_counters_reset_when_last_reset_date_is_old(self, tmp_path):
        from tools.memory_tool import MemoryTool

        path = tmp_path / "state.json"
        path.write_text(json.dumps({
            "commented_media_ids": [],
            "replied_comment_ids": [],
            "followed_usernames": [],
            "daily_comment_count": 5,
            "daily_post_count": 2,
            "daily_follow_count": 10,
            "last_reset_date": "2020-01-01",
        }))

        mem = MemoryTool(state_path=path, comment_log_path=tmp_path / "log.json")
        assert mem.daily_comment_count() == 0
        assert mem.daily_post_count() == 0
        assert mem.daily_follow_count() == 0

    def test_counters_preserved_when_last_reset_date_is_today(self, tmp_path):
        from tools.memory_tool import MemoryTool

        path = tmp_path / "state.json"
        path.write_text(json.dumps({
            "commented_media_ids": [],
            "replied_comment_ids": [],
            "followed_usernames": [],
            "daily_comment_count": 7,
            "daily_post_count": 1,
            "daily_follow_count": 3,
            "last_reset_date": date.today().isoformat(),
        }))

        mem = MemoryTool(state_path=path, comment_log_path=tmp_path / "log.json")
        assert mem.daily_comment_count() == 7
        assert mem.daily_post_count() == 1
        assert mem.daily_follow_count() == 3

    def test_existing_ids_preserved_after_daily_reset(self, tmp_path):
        from tools.memory_tool import MemoryTool

        path = tmp_path / "state.json"
        path.write_text(json.dumps({
            "commented_media_ids": ["url_old"],
            "replied_comment_ids": ["cid_old"],
            "followed_usernames": ["page_old"],
            "daily_comment_count": 99,
            "daily_post_count": 99,
            "daily_follow_count": 99,
            "last_reset_date": "2020-01-01",
        }))

        mem = MemoryTool(state_path=path, comment_log_path=tmp_path / "log.json")
        # Counters reset but historical IDs are kept
        assert mem.has_commented("url_old") is True
        assert mem.has_followed("page_old") is True
        assert mem.has_replied_to_comment("cid_old") is True
        assert mem.daily_comment_count() == 0
