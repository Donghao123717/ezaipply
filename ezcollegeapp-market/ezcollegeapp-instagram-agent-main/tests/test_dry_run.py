from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from tools.instagrapi_tool import IGCommentData, InstagrapiTool


class TestInstagrapiToolDryRun:
    def test_publish_media_post_prints_and_returns_id(self, capsys):
        tool = InstagrapiTool(dry_run=True)
        result = tool.publish_media_post("https://example.com/a.jpg", "caption")
        out = capsys.readouterr().out
        assert result == "dry_run_media_id"
        assert "DRY-RUN" in out

    def test_send_dm_prints_and_returns_thread(self, capsys):
        tool = InstagrapiTool(dry_run=True)
        result = tool.send_dm("student_user", "hello")
        out = capsys.readouterr().out
        assert result == "dry_run_thread"
        assert "student_user" in out

    def test_post_comment_prints_and_returns_id(self, capsys):
        tool = InstagrapiTool(dry_run=True)
        result = tool.post_comment("123", "nice post")
        out = capsys.readouterr().out
        assert result == "dry_run_comment_id"
        assert "nice post" in out

    def test_reply_to_comment_prints_and_returns_id(self, capsys):
        tool = InstagrapiTool(dry_run=True)
        result = tool.reply_to_comment("123", "456", "thanks")
        out = capsys.readouterr().out
        assert result == "dry_run_reply_id"
        assert "comment 456" in out


class TestReplyAgentNoFallback:
    def test_reply_llm_raises_on_empty_generated_reply(self, tmp_memory_dir):
        from agents.reply_agent import ReplyAgent

        llm = MagicMock()
        llm.chat.return_value = "   "

        instagrapi = MagicMock()
        instagrapi.get_post_by_url.return_value = (
            "media_1",
            "https://www.instagram.com/p/ABC123/",
            "post caption",
        )
        instagrapi.get_comments.return_value = [
            IGCommentData(comment_id="c1", text="help?", username="u1", media_id="media_1")
        ]

        agent = ReplyAgent(
            llm=llm,
            instagrapi=instagrapi,
            memory=tmp_memory_dir,
            max_replies_per_run=5,
        )

        with pytest.raises(RuntimeError, match="Generated empty reply"):
            agent.reply_llm(username="owner", post_url="https://www.instagram.com/p/ABC123/")

    def test_reply_manual_requires_manual_replies(self, tmp_memory_dir):
        from agents.reply_agent import ReplyAgent

        llm = MagicMock()
        instagrapi = MagicMock()
        agent = ReplyAgent(llm=llm, instagrapi=instagrapi, memory=tmp_memory_dir)

        with pytest.raises(ValueError, match="manual_replies"):
            agent.reply_manual(username="owner", manual_replies={})
