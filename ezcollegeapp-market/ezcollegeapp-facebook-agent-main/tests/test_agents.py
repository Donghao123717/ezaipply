"""
test_agents.py — tests for all five agents using a mocked PlaywrightTool (live mode).

These tests verify agent logic (rate limits, dedup, LLM routing, memory writes)
without launching a real browser.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import yaml


# ---------------------------------------------------------------------------
# PostAgent
# ---------------------------------------------------------------------------

class TestPostAgent:
    def test_post_manual_publishes_and_logs(self, mock_playwright_live, tmp_memory_dir):
        from agents.post_agent import PostAgent

        agent = PostAgent(
            llm=MagicMock(),
            playwright=mock_playwright_live,
            memory=tmp_memory_dir,
            max_daily_posts=5,
        )
        caption = agent.post_manual("photo.jpg", "My manual caption")

        assert caption == "My manual caption"
        mock_playwright_live.publish_post.assert_called_once_with(
            media_path="photo.jpg", caption="My manual caption"
        )
        assert tmp_memory_dir.daily_post_count() == 1

    def test_post_llm_generates_and_publishes(self, mock_playwright_live, tmp_memory_dir):
        from agents.post_agent import PostAgent

        llm = MagicMock()
        llm.chat.return_value = "CAPTION:\nGenerated caption text"

        agent = PostAgent(
            llm=llm, playwright=mock_playwright_live, memory=tmp_memory_dir, max_daily_posts=5
        )
        caption = agent.post_llm("photo.jpg", post_format="story")

        assert caption == "Generated caption text"
        mock_playwright_live.publish_post.assert_called_once()

    def test_post_manual_enforces_daily_limit(self, mock_playwright_live, tmp_memory_dir):
        from agents.post_agent import PostAgent

        agent = PostAgent(
            llm=MagicMock(),
            playwright=mock_playwright_live,
            memory=tmp_memory_dir,
            max_daily_posts=1,
        )
        agent.post_manual("photo.jpg", "first post")

        with pytest.raises(RuntimeError, match="Daily post limit"):
            agent.post_manual("photo.jpg", "second post")

    def test_post_manual_requires_caption(self, mock_playwright_live, tmp_memory_dir):
        from agents.post_agent import PostAgent

        agent = PostAgent(
            llm=MagicMock(), playwright=mock_playwright_live, memory=tmp_memory_dir
        )
        with pytest.raises(ValueError, match="caption is required"):
            agent.post_manual("photo.jpg", "   ")


# ---------------------------------------------------------------------------
# DMAgent
# ---------------------------------------------------------------------------

class TestDMAgent:
    def test_dm_manual_sends_and_logs(self, mock_playwright_live, tmp_memory_dir):
        from agents.dm_agent import DMAgent

        agent = DMAgent(
            llm=MagicMock(), playwright=mock_playwright_live, memory=tmp_memory_dir
        )
        result = agent.dm_manual("alice", "Hello Alice!")

        assert result == "Hello Alice!"
        mock_playwright_live.send_dm.assert_called_once_with(target="alice", text="Hello Alice!")
        log = tmp_memory_dir.load_comment_log()
        assert any(e["type"] == "dm" and e["target"] == "alice" for e in log)

    def test_dm_llm_generates_and_sends(self, mock_playwright_live, tmp_memory_dir, mock_llm):
        from agents.dm_agent import DMAgent

        agent = DMAgent(
            llm=mock_llm, playwright=mock_playwright_live, memory=tmp_memory_dir
        )
        result = agent.dm_llm("bob", materials="Student asking about deadlines")

        assert result == mock_llm.chat.return_value
        mock_playwright_live.send_dm.assert_called_once()

    def test_dm_manual_requires_text(self, mock_playwright_live, tmp_memory_dir):
        from agents.dm_agent import DMAgent

        agent = DMAgent(
            llm=MagicMock(), playwright=mock_playwright_live, memory=tmp_memory_dir
        )
        with pytest.raises(ValueError, match="text is required"):
            agent.dm_manual("alice", "  ")

    def test_dm_llm_requires_materials(self, mock_playwright_live, tmp_memory_dir):
        from agents.dm_agent import DMAgent

        agent = DMAgent(
            llm=MagicMock(), playwright=mock_playwright_live, memory=tmp_memory_dir
        )
        with pytest.raises(ValueError, match="materials is required"):
            agent.dm_llm("alice", materials="  ")


# ---------------------------------------------------------------------------
# CommentAgent
# ---------------------------------------------------------------------------

class TestCommentAgent:
    def test_comment_manual_posts_and_logs(self, mock_playwright_live, tmp_memory_dir):
        from agents.comment_agent import CommentAgent

        agent = CommentAgent(
            llm=MagicMock(),
            playwright=mock_playwright_live,
            memory=tmp_memory_dir,
            max_daily_comments=10,
        )
        result = agent.comment_manual("https://fb.com/p/1/", "Great post!")

        assert result == "Great post!"
        mock_playwright_live.post_comment.assert_called_once()
        assert tmp_memory_dir.has_commented("https://fb.com/p/1/")

    def test_comment_manual_enforces_daily_limit(self, mock_playwright_live, tmp_memory_dir):
        from agents.comment_agent import CommentAgent

        agent = CommentAgent(
            llm=MagicMock(),
            playwright=mock_playwright_live,
            memory=tmp_memory_dir,
            max_daily_comments=1,
        )
        agent.comment_manual("https://fb.com/p/1/", "first comment")

        with pytest.raises(RuntimeError, match="Daily comment limit"):
            agent.comment_manual("https://fb.com/p/2/", "second comment")

    def test_comment_manual_prevents_duplicate(self, mock_playwright_live, tmp_memory_dir):
        from agents.comment_agent import CommentAgent

        agent = CommentAgent(
            llm=MagicMock(),
            playwright=mock_playwright_live,
            memory=tmp_memory_dir,
            max_daily_comments=10,
        )
        agent.comment_manual("https://fb.com/p/1/", "first comment")

        with pytest.raises(RuntimeError, match="Already commented"):
            agent.comment_manual("https://fb.com/p/1/", "second comment on same post")

    def test_comment_llm_approved_posts(
        self, mock_playwright_live, tmp_memory_dir, mock_llm_with_critique
    ):
        from agents.comment_agent import CommentAgent

        agent = CommentAgent(
            llm=mock_llm_with_critique,
            playwright=mock_playwright_live,
            memory=tmp_memory_dir,
            max_daily_comments=10,
        )
        result = agent.comment_llm("https://fb.com/p/2/", extra_context="college apps stress")

        assert result  # non-empty
        mock_playwright_live.post_comment.assert_called_once()

    def test_comment_llm_rejected_raises(self, mock_playwright_live, tmp_memory_dir):
        from agents.comment_agent import CommentAgent

        llm = MagicMock()
        llm.chat.side_effect = lambda system, user: (
            '{"approved": false, "feedback": "Too promotional"}'
            if "quality reviewer" in system
            else "Generated comment"
        )

        agent = CommentAgent(
            llm=llm,
            playwright=mock_playwright_live,
            memory=tmp_memory_dir,
            max_daily_comments=10,
        )
        with pytest.raises(RuntimeError, match="rejected by self-critique"):
            agent.comment_llm("https://fb.com/p/3/")


# ---------------------------------------------------------------------------
# ReplyAgent
# ---------------------------------------------------------------------------

class TestReplyAgent:
    def _make_comments(self, post_url, n=2):
        from tools.playwright_tool import FBCommentData
        return [
            FBCommentData(
                comment_id=f"cid{i}",
                text=f"Comment number {i}",
                username=f"user{i}",
                post_url=post_url,
                index=i,
            )
            for i in range(n)
        ]

    def test_reply_llm_replies_to_new_comments(
        self, mock_playwright_live, tmp_memory_dir, mock_llm
    ):
        from agents.reply_agent import ReplyAgent

        post_url = "https://fb.com/p/10/"
        mock_playwright_live.get_comments.return_value = self._make_comments(post_url)

        agent = ReplyAgent(
            llm=mock_llm,
            playwright=mock_playwright_live,
            memory=tmp_memory_dir,
            max_replies_per_run=5,
        )
        count = agent.reply_llm(post_url)

        assert count == 2
        assert mock_playwright_live.reply_to_comment.call_count == 2

    def test_reply_llm_skips_already_replied(
        self, mock_playwright_live, tmp_memory_dir, mock_llm
    ):
        from agents.reply_agent import ReplyAgent

        post_url = "https://fb.com/p/11/"
        comments = self._make_comments(post_url, n=2)
        mock_playwright_live.get_comments.return_value = comments
        tmp_memory_dir.mark_replied_to_comment("cid0")

        agent = ReplyAgent(
            llm=mock_llm,
            playwright=mock_playwright_live,
            memory=tmp_memory_dir,
            max_replies_per_run=5,
        )
        count = agent.reply_llm(post_url)

        assert count == 1
        assert mock_playwright_live.reply_to_comment.call_count == 1

    def test_reply_llm_raises_on_empty_generated_reply(
        self, mock_playwright_live, tmp_memory_dir
    ):
        from agents.reply_agent import ReplyAgent

        post_url = "https://fb.com/p/12/"
        mock_playwright_live.get_comments.return_value = self._make_comments(post_url, n=1)

        llm = MagicMock()
        llm.chat.return_value = "   "

        agent = ReplyAgent(
            llm=llm,
            playwright=mock_playwright_live,
            memory=tmp_memory_dir,
        )
        with pytest.raises(RuntimeError, match="empty reply"):
            agent.reply_llm(post_url)

    def test_reply_manual_requires_replies(self, mock_playwright_live, tmp_memory_dir):
        from agents.reply_agent import ReplyAgent

        agent = ReplyAgent(
            llm=MagicMock(), playwright=mock_playwright_live, memory=tmp_memory_dir
        )
        with pytest.raises(ValueError, match="manual_replies is required"):
            agent.reply_manual("https://fb.com/p/1/", manual_replies={})

    def test_reply_manual_sends_matching_replies(
        self, mock_playwright_live, tmp_memory_dir
    ):
        from agents.reply_agent import ReplyAgent

        post_url = "https://fb.com/p/13/"
        mock_playwright_live.get_comments.return_value = self._make_comments(post_url, n=2)

        agent = ReplyAgent(
            llm=MagicMock(),
            playwright=mock_playwright_live,
            memory=tmp_memory_dir,
            max_replies_per_run=5,
        )
        count = agent.reply_manual(
            post_url, manual_replies={"cid0": "reply to zero", "cid1": "reply to one"}
        )

        assert count == 2


# ---------------------------------------------------------------------------
# FollowAgent
# ---------------------------------------------------------------------------

class TestFollowAgent:
    def _make_agent(self, playwright, memory, min_per_day=2, max_per_day=4,
                    delay_min=0, delay_max=0, active_hours=None):
        from agents.follow_agent import FollowAgent

        return FollowAgent(
            playwright=playwright,
            memory=memory,
            min_per_day=min_per_day,
            max_per_day=max_per_day,
            delay_min=delay_min,
            delay_max=delay_max,
            active_hours=active_hours,
        )

    def test_follow_batch_follows_accounts(
        self, mock_playwright_live, tmp_memory_dir
    ):
        agent = self._make_agent(
            mock_playwright_live, tmp_memory_dir, min_per_day=3, max_per_day=3
        )
        count = agent.follow_batch(["page_a", "page_b", "page_c"])

        assert count == {"followed": 3, "friend_requested": 0}
        assert mock_playwright_live.follow_user.call_count == 3

    def test_follow_batch_skips_already_followed(
        self, mock_playwright_live, tmp_memory_dir
    ):
        tmp_memory_dir.mark_followed("existing_page")
        agent = self._make_agent(
            mock_playwright_live, tmp_memory_dir, min_per_day=2, max_per_day=2
        )
        with patch("random.sample", side_effect=lambda pop, k: pop[:k]):
            agent.follow_batch(["existing_page", "new_a", "new_b"])

        for call in mock_playwright_live.follow_user.call_args_list:
            assert call.args[0] != "existing_page"

    def test_follow_batch_returns_zero_when_all_followed(
        self, mock_playwright_live, tmp_memory_dir
    ):
        for p in ["x", "y", "z"]:
            tmp_memory_dir.mark_followed(p)

        agent = self._make_agent(mock_playwright_live, tmp_memory_dir)
        count = agent.follow_batch(["x", "y", "z"])

        assert count == {"followed": 0, "friend_requested": 0}
        mock_playwright_live.follow_user.assert_not_called()

    def test_follow_batch_respects_daily_cap(
        self, mock_playwright_live, tmp_memory_dir
    ):
        agent = self._make_agent(
            mock_playwright_live, tmp_memory_dir, min_per_day=2, max_per_day=3
        )
        for i in range(3):
            tmp_memory_dir.mark_followed(f"pre_{i}")

        count = agent.follow_batch(["new_a", "new_b"])

        assert count == {"followed": 0, "friend_requested": 0}
        mock_playwright_live.follow_user.assert_not_called()

    def test_follow_batch_records_in_memory(
        self, mock_playwright_live, tmp_memory_dir
    ):
        agent = self._make_agent(
            mock_playwright_live, tmp_memory_dir, min_per_day=2, max_per_day=2
        )
        with patch("random.sample", side_effect=lambda pop, k: pop[:k]):
            agent.follow_batch(["page1", "page2", "page3"])

        assert tmp_memory_dir.has_followed("page1")
        assert tmp_memory_dir.has_followed("page2")

    def test_follow_batch_skips_outside_active_hours(
        self, mock_playwright_live, tmp_memory_dir
    ):
        agent = self._make_agent(
            mock_playwright_live, tmp_memory_dir, active_hours=(9, 17)
        )
        with patch("agents.follow_agent.datetime") as mock_dt:
            mock_dt.now.return_value.hour = 3
            count = agent.follow_batch(["anyone"])

        assert count == {"followed": 0, "friend_requested": 0}
        mock_playwright_live.follow_user.assert_not_called()

    def test_follow_batch_runs_inside_active_hours(
        self, mock_playwright_live, tmp_memory_dir
    ):
        agent = self._make_agent(
            mock_playwright_live, tmp_memory_dir,
            min_per_day=1, max_per_day=1, active_hours=(9, 17)
        )
        with patch("agents.follow_agent.datetime") as mock_dt:
            mock_dt.now.return_value.hour = 12
            mock_dt.now.return_value.isoformat.return_value = "2026-05-12T12:00:00+00:00"
            count = agent.follow_batch(["inside_page"])

        assert count == {"followed": 1, "friend_requested": 0}


# ---------------------------------------------------------------------------
# Orchestrator run_job
# ---------------------------------------------------------------------------

class TestOrchestratorRunJob:
    def _patch_orchestrator(self, monkeypatch, tmp_memory_dir):
        from agents import orchestrator as orch_mod

        class FakeLLM:
            def __init__(self, provider=None, model=None):
                pass
            def chat(self, system, user):
                return "CAPTION:\nGenerated"

        class FakePlaywright:
            dry_run = False
            def follow_user(self, page_id): return "followed"
            def publish_post(self, media_path, caption): return "post_1"
            def send_dm(self, target, text): return "thread_1"
            def get_post_by_url(self, url): return "m1", url, "caption"
            def post_comment(self, post_url, text): return "comment_1"
            def get_comments(self, post_url, limit=20): return []
            def reply_to_comment(self, post_url, comment_index, text): return "reply_1"
            def close(self): pass

        monkeypatch.setattr(orch_mod, "LLMClient", FakeLLM)
        monkeypatch.setattr(orch_mod, "PlaywrightTool", lambda **_: FakePlaywright())
        monkeypatch.setattr(orch_mod, "MemoryTool", lambda: tmp_memory_dir)

    def test_run_job_manual_post_and_dm(
        self, monkeypatch, tmp_path, tmp_memory_dir
    ):
        from agents import orchestrator as orch_mod

        self._patch_orchestrator(monkeypatch, tmp_memory_dir)

        job = {
            "mode": "manual",
            "post": {
                "enabled": True,
                "media": "photo.jpg",
                "caption": "manual caption",
            },
            "dm": {
                "enabled": True,
                "recipients": [{"target": "alice", "text": "hello"}],
            },
        }
        job_path = tmp_path / "job.yaml"
        job_path.write_text(yaml.safe_dump(job))

        orch = orch_mod.Orchestrator()
        summary = orch.run_job(str(job_path))

        assert summary["mode"] == "manual"
        assert summary["results"]["post"]["ok"] is True
        assert summary["results"]["dm"]["ok"] is True
        assert summary["results"]["dm"]["sent"][0]["target"] == "alice"

    def test_run_job_follow_inline(
        self, monkeypatch, tmp_path, tmp_memory_dir
    ):
        from agents import orchestrator as orch_mod

        self._patch_orchestrator(monkeypatch, tmp_memory_dir)

        job = {
            "mode": "manual",
            "follow": {
                "enabled": True,
                "accounts": ["page_a", "page_b", "page_c"],
            },
        }
        job_path = tmp_path / "job.yaml"
        job_path.write_text(yaml.safe_dump(job))

        orch = orch_mod.Orchestrator()
        orch.follow_agent.min_per_day = 3
        orch.follow_agent.max_per_day = 3
        orch.follow_agent.delay_min = 0
        orch.follow_agent.delay_max = 0

        with patch("random.sample", side_effect=lambda pop, k: pop[:k]):
            summary = orch.run_job(str(job_path))

        assert summary["results"]["follow"]["ok"] is True
        assert summary["results"]["follow"]["followed"] == 3
        assert summary["results"]["follow"]["friend_requested"] == 0
