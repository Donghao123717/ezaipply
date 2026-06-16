"""
test_dry_run.py — verifies PlaywrightTool dry-run behavior for all five write operations.

In dry_run=True mode every write method must:
  - Print a [DRY-RUN] block to stdout
  - Return the expected mock value
  - Never call _get_page() (no browser launched)
  - Never update memory state
"""
from __future__ import annotations

from unittest.mock import patch


class TestPlaywrightToolDryRun:
    def test_follow_user_prints_and_returns_true(self, capsys):
        from tools.playwright_tool import PlaywrightTool

        tool = PlaywrightTool(dry_run=True)
        result = tool.follow_user("commonapp")
        out = capsys.readouterr().out

        assert result is True
        assert "DRY-RUN" in out
        assert "commonapp" in out

    def test_publish_post_prints_and_returns_id(self, capsys):
        from tools.playwright_tool import PlaywrightTool

        tool = PlaywrightTool(dry_run=True)
        result = tool.publish_post("photo.jpg", "My caption here")
        out = capsys.readouterr().out

        assert result == "dry_run_post_id"
        assert "DRY-RUN" in out
        assert "My caption here" in out

    def test_send_dm_prints_and_returns_thread(self, capsys):
        from tools.playwright_tool import PlaywrightTool

        tool = PlaywrightTool(dry_run=True)
        result = tool.send_dm("someprofile", "Hello!")
        out = capsys.readouterr().out

        assert result == "dry_run_thread"
        assert "DRY-RUN" in out
        assert "someprofile" in out

    def test_post_comment_prints_and_returns_id(self, capsys):
        from tools.playwright_tool import PlaywrightTool

        tool = PlaywrightTool(dry_run=True)
        result = tool.post_comment("https://facebook.com/permalink/123/", "Great post!")
        out = capsys.readouterr().out

        assert result == "dry_run_comment_id"
        assert "DRY-RUN" in out
        assert "Great post!" in out

    def test_reply_to_comment_prints_and_returns_id(self, capsys):
        from tools.playwright_tool import PlaywrightTool

        tool = PlaywrightTool(dry_run=True)
        result = tool.reply_to_comment(
            "https://facebook.com/permalink/123/", comment_index=0, text="Thanks!"
        )
        out = capsys.readouterr().out

        assert result == "dry_run_reply_id"
        assert "DRY-RUN" in out
        assert "Thanks!" in out

    def test_dry_run_never_launches_browser(self):
        """_get_page() must not be called for any write operation in dry_run mode."""
        from tools.playwright_tool import PlaywrightTool

        tool = PlaywrightTool(dry_run=True)
        with patch.object(tool, "_get_page") as mock_get_page:
            tool.follow_user("anyone")
            tool.publish_post("photo.jpg", "caption")
            tool.send_dm("someone", "hello")
            tool.post_comment("https://fb.com/p/1/", "nice")
            tool.reply_to_comment("https://fb.com/p/1/", 0, "thanks")

        mock_get_page.assert_not_called()

    def test_dry_run_does_not_update_memory(self, tmp_memory_dir, capsys):
        """Dry-run follows must not write to memory state."""
        from agents.follow_agent import FollowAgent
        from tools.playwright_tool import PlaywrightTool

        tool = PlaywrightTool(dry_run=True)
        agent = FollowAgent(
            playwright=tool,
            memory=tmp_memory_dir,
            min_per_day=1,
            max_per_day=1,
            delay_min=0,
            delay_max=0,
        )
        agent.follow_batch(["dry_page"])

        assert tmp_memory_dir.has_followed("dry_page") is False
        assert tmp_memory_dir.daily_follow_count() == 0
