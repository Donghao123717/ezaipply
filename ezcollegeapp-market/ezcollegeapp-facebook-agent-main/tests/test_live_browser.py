"""
test_live_browser.py — smoke tests with a real Chromium browser and Facebook session.

SKIPPED by default. To run:

    LIVE_BROWSER_TEST=1 python3.12 -m pytest tests/test_live_browser.py -v -s

On first run, a browser window opens and you must log in to Facebook manually.
The session is saved to memory/fb_browser_data/ and reused on subsequent runs.

WARNING: Tests in TestLiveBrowserWrites use dry_run=False and WILL perform real
Facebook actions. Only run on accounts you are willing to lose — Facebook may
restrict or ban accounts that exhibit automation behaviour.

Env vars (set in .env):
  LIVE_BROWSER_TEST=1               required to run any test in this file

  TEST_FB_POST_CAPTION              caption text for publish-post test
  TEST_FB_POST_MEDIA                path to image file (optional, e.g. ./assets/photo.jpg)

  TEST_FB_COMMENT_URL               post URL to comment on
  TEST_FB_COMMENT_TEXT              comment text

  TEST_FB_REPLY_URL                 post URL whose comments you want to reply to
  TEST_FB_REPLY_COMMENT_INDEX       which comment to reply to (0 = first, 1 = second, ...)
  TEST_FB_REPLY_TEXT                reply text

  TEST_FB_FOLLOW_TARGET             account slug to follow/add-friend (e.g. john.smith.123)

  TEST_FB_POST_URL                  public post URL used by the read-only get_comments test
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

_live = pytest.mark.skipif(
    not os.getenv("LIVE_BROWSER_TEST"),
    reason="Set LIVE_BROWSER_TEST=1 to run live browser tests",
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def live_tool():
    """
    Real PlaywrightTool(dry_run=False).
    Set PLAYWRIGHT_HEADLESS=1 in .env to run without a display (server mode).
    First run must be headed (PLAYWRIGHT_HEADLESS=0) to log in manually.
    """
    from tools.playwright_tool import PlaywrightTool

    headless = os.getenv("PLAYWRIGHT_HEADLESS", "0") == "1"
    tool = PlaywrightTool(dry_run=False, delay_min=1, delay_max=3, headless=headless)
    yield tool
    tool.close()


# ---------------------------------------------------------------------------
# Browser session tests — read-only, safe to run any time
# ---------------------------------------------------------------------------

class TestBrowserSession:
    @_live
    def test_browser_launches_and_login_detected(self, live_tool):
        """Verify that Playwright starts and the Facebook login session is valid."""
        page = live_tool._get_page()
        assert page is not None
        assert live_tool._is_logged_in() is True

    @_live
    def test_get_comments_returns_structured_data(self, live_tool):
        """
        Fetch comments from a real public Facebook post (read-only).
        Set TEST_FB_POST_URL to a public post permalink before running.
        """
        post_url = os.getenv("TEST_FB_POST_URL", "")
        if not post_url:
            pytest.skip("Set TEST_FB_POST_URL to a public Facebook post URL")

        from tools.playwright_tool import FBCommentData

        comments = live_tool.get_comments(post_url, limit=5)
        assert isinstance(comments, list)
        for c in comments:
            assert isinstance(c, FBCommentData)
            assert c.comment_id, "comment_id must be non-empty"
            assert c.text, "text must be non-empty"
            assert c.username != "unknown"
            assert c.post_url == post_url


# ---------------------------------------------------------------------------
# Write tests — PERFORM REAL FACEBOOK ACTIONS
# ---------------------------------------------------------------------------

class TestLiveBrowserWrites:
    @_live
    def test_publish_post(self, live_tool):
        """
        Publishes a real post to your Facebook feed.
        Set TEST_FB_POST_CAPTION (required).
        Set TEST_FB_POST_MEDIA to an image path (optional — omit for text-only post).
        """
        caption = os.getenv("TEST_FB_POST_CAPTION", "")
        if not caption:
            pytest.skip("Set TEST_FB_POST_CAPTION to run this test")

        media = os.getenv("TEST_FB_POST_MEDIA", "")
        result = live_tool.publish_post(media_path=media, caption=caption)
        assert result is not None

    @_live
    def test_post_comment(self, live_tool):
        """
        Posts a real comment on a Facebook post.
        Set TEST_FB_COMMENT_URL and TEST_FB_COMMENT_TEXT before running.
        """
        post_url = os.getenv("TEST_FB_COMMENT_URL", "")
        comment_text = os.getenv("TEST_FB_COMMENT_TEXT", "")
        if not post_url or not comment_text:
            pytest.skip("Set TEST_FB_COMMENT_URL and TEST_FB_COMMENT_TEXT to run this test")

        result = live_tool.post_comment(post_url, comment_text)
        assert result is not None

    @_live
    def test_reply_to_comment(self, live_tool):
        """
        Replies to a comment on a Facebook post.
        Set TEST_FB_REPLY_URL and TEST_FB_REPLY_TEXT (required).
        Set TEST_FB_REPLY_COMMENT_INDEX to choose which comment (default: 0 = first).
        """
        post_url = os.getenv("TEST_FB_REPLY_URL", "")
        reply_text = os.getenv("TEST_FB_REPLY_TEXT", "")
        if not post_url or not reply_text:
            pytest.skip("Set TEST_FB_REPLY_URL and TEST_FB_REPLY_TEXT to run this test")

        comment_index = int(os.getenv("TEST_FB_REPLY_COMMENT_INDEX", "0"))
        result = live_tool.reply_to_comment(post_url, comment_index=comment_index, text=reply_text)
        assert result is not None

    @_live
    def test_follow_account(self, live_tool):
        """
        Follows a page or sends a friend request to a personal account.
        Set TEST_FB_FOLLOW_TARGET to the account slug (e.g. john.smith.123).
        Returns "followed" for pages/public figures, "friend_requested" for personal accounts.
        """
        target = os.getenv("TEST_FB_FOLLOW_TARGET", "")
        if not target:
            pytest.skip("Set TEST_FB_FOLLOW_TARGET to an account slug")

        result = live_tool.follow_user(target)
        assert result in ("followed", "friend_requested"), (
            f"Unexpected result: {result!r}. Expected 'followed' or 'friend_requested'."
        )
        print(f"\nAction taken for @{target}: {result}")
