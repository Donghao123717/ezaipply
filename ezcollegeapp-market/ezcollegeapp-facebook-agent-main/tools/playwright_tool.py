"""
PlaywrightTool: controls a real Chrome browser via Playwright to interact with Facebook.

All write operations are guarded by dry_run.
On the first run the browser window opens and you must log in manually.
The session is saved to memory/fb_browser_data/ so subsequent runs skip login.

WARNING: Automating Facebook with a personal account violates Facebook's Terms of Service.
Account restrictions or bans are possible. Use only on accounts you are willing to lose.
"""
from __future__ import annotations

import atexit
import hashlib
import logging
import math
import random
import time
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_SESSION_DIR = Path(__file__).parent.parent / "memory" / "fb_browser_data"

_STEALTH_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
Object.defineProperty(navigator, 'plugins', {get: () => [
    {name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer'},
]});
Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
window.chrome = {runtime: {}};
"""

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/136.0.0.0 Safari/537.36"
)


@dataclass
class FBCommentData:
    """A top-level comment on a Facebook post."""
    comment_id: str   # stable hash of post_url + username + text snippet
    text: str
    username: str
    post_url: str
    index: int        # position in comment list (used to find Reply button)


class PlaywrightTool:
    """
    Thin wrapper around a Playwright persistent browser context.

    Read operations run in all modes.
    Write operations are skipped in dry_run mode (they print instead).
    """

    def __init__(
        self,
        dry_run: bool = True,
        delay_min: int = 15,
        delay_max: int = 45,
        headless: bool = False,
    ):
        self.dry_run = dry_run
        self.delay_min = delay_min
        self.delay_max = delay_max
        self.headless = headless
        self._playwright = None
        self._context = None
        self._page = None

    # ------------------------------------------------------------------
    # Public: reads
    # ------------------------------------------------------------------

    def get_comments(self, post_url: str, limit: int = 20) -> list[FBCommentData]:
        """
        Return top-level comments on a Facebook post.
        Runs in both dry-run and live mode.
        """
        page = self._get_page()
        try:
            page.goto(post_url, wait_until="domcontentloaded", timeout=30000)
            self._short_delay()
            self._dismiss_popups()

            # Expand visible comments
            for _ in range(3):
                try:
                    more = page.query_selector(
                        'div[role="button"]:has-text("View more comments")'
                    )
                    if more and more.is_visible():
                        more.click()
                        time.sleep(2)
                    else:
                        break
                except Exception:
                    break

            comments: list[FBCommentData] = []
            containers = page.query_selector_all('div[aria-label*="Comment by"]')

            # Fallback: articles after the first (which is the post itself)
            if not containers:
                all_articles = page.query_selector_all('[role="article"]')
                containers = list(all_articles)[1:]

            for i, el in enumerate(containers[:limit]):
                try:
                    # Author name — first link inside the comment
                    author_link = el.query_selector('a[role="link"]')
                    username = author_link.inner_text().strip() if author_link else "unknown"

                    # Comment text — div with dir="auto" (Facebook user content)
                    text_divs = el.query_selector_all('div[dir="auto"]')
                    text = " ".join(
                        d.inner_text().strip() for d in text_divs if d.inner_text().strip()
                    )

                    if not text or username == "unknown":
                        continue

                    comment_id = hashlib.sha1(
                        f"{post_url}:{username}:{text[:40]}".encode()
                    ).hexdigest()[:12]

                    comments.append(
                        FBCommentData(
                            comment_id=comment_id,
                            text=text,
                            username=username,
                            post_url=post_url,
                            index=i,
                        )
                    )
                except Exception:
                    continue

            logger.info("Found %d comment(s) on %s", len(comments), post_url)
            return comments

        except Exception as exc:
            logger.error("Failed to fetch comments from %s: %s", post_url, exc)
            return []

    # ------------------------------------------------------------------
    # Public: writes
    # ------------------------------------------------------------------

    def follow_user(self, page_id: str) -> bool:
        """
        Follow a Facebook page or profile by its page_id (slug or numeric).

        In dry-run mode prints the action instead of following.
        Returns True on success, False on failure.
        """
        if self.dry_run:
            self._dry_print(f"Would follow @{page_id}")
            return True

        page = self._get_page()
        profile_url = f"https://www.facebook.com/{page_id}"
        try:
            page.goto(profile_url, wait_until="domcontentloaded", timeout=30000)
            self._short_delay()
            self._dismiss_popups()

            block = self._detect_block()
            if block:
                logger.warning("Block signal detected on %s: %s", page_id, block)
                return False

            # Check already following
            for sel in ('div[aria-label="Following"][role="button"]', 'a[aria-label="Following"]'):
                el = page.query_selector(sel)
                if el and el.is_visible() and self._in_header(page, el):
                    logger.info("Already following @%s", page_id)
                    return "followed"

            # Check already friends — only when no Follow button exists (personal profile, not a page)
            follow_btn_exists = any(
                (lambda el: el and el.is_visible() and self._in_header(page, el))(
                    page.query_selector(sel)
                )
                for sel in ('div[aria-label="Follow"][role="button"]', 'a[aria-label="Follow"]')
            )
            if not follow_btn_exists:
                for sel in ('div[aria-label="Friends"][role="button"]',
                            'div[aria-label="Friend request sent"][role="button"]'):
                    el = page.query_selector(sel)
                    if el and el.is_visible() and self._in_header(page, el):
                        logger.info("Already friends / request pending for @%s", page_id)
                        return "friend_requested"

            # Click Follow (pages / public figures)
            for sel in (
                'div[aria-label="Follow"][role="button"]',
                'a[aria-label="Follow"]',
            ):
                btn = page.query_selector(sel)
                if btn and btn.is_visible() and self._in_header(page, btn):
                    btn.click()
                    time.sleep(random.uniform(2, 4))
                    block = self._detect_block()
                    if block:
                        logger.warning("Block after follow click on %s: %s", page_id, block)
                        return False
                    logger.info("Followed @%s", page_id)
                    return "followed"

            # Click Add Friend (personal accounts)
            for sel in (
                'div[aria-label="Add friend"][role="button"]',
                'a[aria-label="Add friend"]',
            ):
                btn = page.query_selector(sel)
                if btn and btn.is_visible() and self._in_header(page, btn):
                    btn.click()
                    time.sleep(random.uniform(2, 4))
                    block = self._detect_block()
                    if block:
                        logger.warning("Block after add friend click on %s: %s", page_id, block)
                        return False
                    logger.info("Sent friend request to @%s", page_id)
                    return "friend_requested"

            # Text-based fallback for both
            for btn in page.query_selector_all('div[role="button"], button'):
                try:
                    text = btn.inner_text().strip()
                    if text == "Follow" and btn.is_visible() and self._in_header(page, btn):
                        btn.click()
                        time.sleep(random.uniform(2, 4))
                        logger.info("Followed @%s (text fallback)", page_id)
                        return "followed"
                    if text in ("Add friend", "Add Friend") and btn.is_visible() and self._in_header(page, btn):
                        btn.click()
                        time.sleep(random.uniform(2, 4))
                        logger.info("Sent friend request to @%s (text fallback)", page_id)
                        return "friend_requested"
                except Exception:
                    continue

            logger.warning("Follow/Add Friend button not found for @%s", page_id)
            return False

        except Exception as exc:
            logger.error("Failed to follow @%s: %s", page_id, exc)
            return False

    def publish_post(self, media_path: str, caption: str) -> str | None:
        """
        Publish a photo/video post to the Facebook feed.

        In dry-run mode prints the action.
        Returns a mock/real post identifier on success, None on failure.
        """
        if self.dry_run:
            self._dry_print(f"Would publish post:\nMedia: {media_path}\n\n{caption}")
            return "dry_run_post_id"

        page = self._get_page()
        try:
            page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=30000)
            self._short_delay()
            self._dismiss_popups()
            self._dismiss_popups()
            page.evaluate("window.scrollTo(0, 0)")
            time.sleep(1)
            logger.info("[publish] step 1: on homepage")

            # Find the first VISIBLE "What's on your mind" box — the DOM may contain hidden duplicates
            box = None
            for candidate in page.query_selector_all('div[role="button"][aria-label*="mind" i]'):
                if candidate.is_visible():
                    box = candidate
                    break
            if not box:
                for candidate in page.query_selector_all('div[role="button"]:has-text("What\'s on your mind")'):
                    if candidate.is_visible():
                        box = candidate
                        break
            if not box:
                logger.error("[publish] step 2: could not find visible What's on your mind box")
                return None
            logger.info("[publish] step 2: found visible box, clicking")
            box.click()
            time.sleep(2)

            if media_path:
                logger.info("[publish] step 3: uploading media")
                photo_btn = page.query_selector('[aria-label="Photo/video"]')
                if photo_btn:
                    photo_btn.click(force=True)
                    time.sleep(1)
                file_input = page.query_selector('input[type="file"]')
                if file_input:
                    file_input.set_input_files(media_path)
                    time.sleep(4)
                back_btn = (
                    page.query_selector('[aria-label="Back"]')
                    or page.query_selector('div[role="button"][aria-label="Back"]')
                )
                if back_btn and back_btn.is_visible():
                    logger.info("[publish] step 3b: clicking Back button")
                    back_btn.click(force=True)
                    time.sleep(1)

            text_box = (
                page.query_selector('div[role="dialog"] div[role="textbox"]')
                or page.query_selector('div[role="dialog"] div[contenteditable="true"]')
                or page.query_selector('div[role="textbox"][aria-label*="mind" i]')
            )
            logger.info("[publish] step 4: text_box found = %s", text_box is not None)
            if text_box:
                logger.info("[publish] step 4b: clicking text_box")
                text_box.click(force=True)
                logger.info("[publish] step 4c: typing caption")
                time.sleep(0.5)
                page.keyboard.type(caption)
                time.sleep(1)

            next_btn = page.query_selector('div[role="dialog"] div[aria-label="Next"][role="button"]')
            if not next_btn:
                next_btn = page.query_selector('div[role="dialog"] div[role="button"]:has-text("Next")')
            logger.info("[publish] step 5: next_btn found = %s", next_btn is not None)
            if next_btn and next_btn.is_visible():
                logger.info("[publish] step 5b: clicking Next")
                next_btn.click(force=True)
                time.sleep(3)

            post_btn = page.query_selector('div[role="dialog"] div[aria-label="Post"][role="button"]')
            if not post_btn:
                post_btn = page.query_selector('div[role="dialog"] div[role="button"]:has-text("Post")')
            logger.info("[publish] step 6: post_btn found = %s", post_btn is not None)
            if post_btn:
                logger.info("[publish] step 6b: clicking Post")
                post_btn.click(force=True)
                time.sleep(4)
                logger.info("Published Facebook post")
                return "fb_post_published"

            logger.error("[publish] step 6: could not find Post button")
            return None

        except Exception as exc:
            logger.error("Failed to publish post: %s", exc)
            return None

    def send_dm(self, target: str, text: str) -> str | None:
        """
        Send a Facebook Messenger DM to a user by profile slug or URL.

        In dry-run mode prints the action.
        Returns thread identifier on success, None on failure.
        """
        if self.dry_run:
            self._dry_print(f"Would send DM to @{target}:\n\n{text}")
            return "dry_run_thread"

        page = self._get_page()
        profile_url = target if target.startswith("http") else f"https://www.facebook.com/{target}"
        try:
            page.goto(profile_url, wait_until="domcontentloaded", timeout=30000)
            self._short_delay()
            self._dismiss_popups()

            # Click Message button on profile
            msg_btn = page.query_selector('[aria-label="Message"]')
            if not msg_btn:
                msg_btn = page.query_selector('div[role="button"]:has-text("Message")')
            if not msg_btn:
                logger.error("Message button not found for @%s", target)
                return None

            msg_btn.click()
            time.sleep(3)

            # Find chat input (may be in a panel or new tab)
            chat_input = page.query_selector('div[role="textbox"][aria-label*="message" i]')
            if not chat_input:
                chat_input = page.query_selector('div[role="textbox"]')
            if not chat_input:
                logger.error("Chat input not found for @%s", target)
                return None

            chat_input.click()
            time.sleep(0.5)
            page.keyboard.type(text)
            time.sleep(0.5)
            page.keyboard.press("Enter")
            time.sleep(2)
            logger.info("Sent DM to @%s", target)
            return "dm_sent"

        except Exception as exc:
            logger.error("Failed to send DM to @%s: %s", target, exc)
            return None

    def post_comment(self, post_url: str, text: str) -> str | None:
        """
        Post a top-level comment on a Facebook post URL.

        In dry-run mode prints the action.
        Returns a comment identifier on success, None on failure.
        """
        if self.dry_run:
            self._dry_print(f"Would comment on {post_url}:\n\n{text}")
            return "dry_run_comment_id"

        page = self._get_page()
        try:
            page.goto(post_url, wait_until="domcontentloaded", timeout=30000)
            self._short_delay()
            self._dismiss_popups()

            block = self._detect_block()
            if block:
                logger.warning("Block signal before comment: %s", block)
                return None

            # Find comment input
            comment_box = page.query_selector('div[role="textbox"][aria-label*="comment" i]')
            if not comment_box:
                comment_box = page.query_selector(
                    'div[contenteditable="true"][aria-label*="comment" i]'
                )
            if not comment_box:
                logger.error("Comment input not found on %s", post_url)
                return None

            comment_box.click()
            time.sleep(0.5)
            page.keyboard.type(text)
            time.sleep(0.5)
            page.keyboard.press("Enter")
            time.sleep(2)

            block = self._detect_block()
            if block:
                logger.warning("Block signal after posting comment: %s", block)
                return None

            logger.info("Posted comment on %s", post_url)
            return "fb_comment_posted"

        except Exception as exc:
            logger.error("Failed to post comment on %s: %s", post_url, exc)
            return None

    def reply_to_comment(
        self, post_url: str, comment_index: int, text: str
    ) -> str | None:
        """
        Reply to the comment at comment_index on a Facebook post.

        In dry-run mode prints the action.
        Returns a reply identifier on success, None on failure.
        """
        if self.dry_run:
            self._dry_print(f"Would reply to comment #{comment_index} on {post_url}:\n\n{text}")
            return "dry_run_reply_id"

        page = self._get_page()
        try:
            page.goto(post_url, wait_until="domcontentloaded", timeout=30000)
            self._short_delay()
            self._dismiss_popups()

            block = self._detect_block()
            if block:
                logger.warning("Block signal before reply: %s", block)
                return None

            containers = page.query_selector_all('div[aria-label*="Comment by"]')
            if not containers:
                all_articles = page.query_selector_all('[role="article"]')
                containers = list(all_articles)[1:]

            containers = list(containers)
            if comment_index >= len(containers):
                logger.error(
                    "Comment index %d out of range (found %d comments)",
                    comment_index,
                    len(containers),
                )
                return None

            container = containers[comment_index]

            # Click Reply button inside this comment
            reply_btn = container.query_selector('div[role="button"]:has-text("Reply")')
            if not reply_btn:
                reply_btn = container.query_selector('[aria-label="Reply"]')
            if not reply_btn:
                logger.error("Reply button not found for comment %d", comment_index)
                return None

            reply_btn.click()
            time.sleep(1.5)

            # Reply input that appears below
            reply_input = page.query_selector('div[role="textbox"][aria-label*="reply" i]')
            if not reply_input:
                reply_input = page.query_selector('div[role="textbox"]')
            if not reply_input:
                logger.error("Reply input not found for comment %d", comment_index)
                return None

            reply_input.click()
            time.sleep(0.5)
            page.keyboard.type(text)
            time.sleep(0.5)
            page.keyboard.press("Enter")
            time.sleep(2)

            logger.info("Replied to comment %d on %s", comment_index, post_url)
            return f"reply_{comment_index}"

        except Exception as exc:
            logger.error(
                "Failed to reply to comment %d on %s: %s", comment_index, post_url, exc
            )
            return None

    def close(self) -> None:
        """Release the browser and Playwright instance."""
        try:
            if self._context:
                self._context.close()
                self._context = None
            if self._playwright:
                self._playwright.stop()
                self._playwright = None
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _get_page(self):
        if self._page is not None:
            return self._page

        from playwright.sync_api import sync_playwright  # type: ignore

        self._playwright = sync_playwright().start()
        _SESSION_DIR.mkdir(parents=True, exist_ok=True)

        viewport_w, viewport_h = random.choice([
            (1280, 800), (1366, 768), (1440, 900), (1920, 1080),
        ])

        self._context = self._playwright.chromium.launch_persistent_context(
            user_data_dir=str(_SESSION_DIR),
            headless=self.headless,
            viewport={"width": viewport_w, "height": viewport_h},
            locale="en-US",
            timezone_id="America/New_York",
            user_agent=_USER_AGENT,
            args=["--disable-blink-features=AutomationControlled"],
        )
        self._context.add_init_script(_STEALTH_SCRIPT)
        self._page = (
            self._context.pages[0] if self._context.pages else self._context.new_page()
        )
        atexit.register(self.close)
        self._ensure_logged_in()
        return self._page

    def _ensure_logged_in(self) -> None:
        page = self._page
        page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=30000)
        time.sleep(3)
        self._dismiss_popups()

        if not self._is_logged_in():
            if self.headless:
                raise RuntimeError(
                    "Not logged in to Facebook. "
                    "Run once with PLAYWRIGHT_HEADLESS=0 (or unset) to log in manually — "
                    "the session is then saved to memory/fb_browser_data/ and reused in headless mode."
                )
            print("\n" + "=" * 60)
            print("  Please log in to Facebook in the browser window.")
            print("  After you see the home feed, press Enter here.")
            print("=" * 60)
            input("\n>>> Press Enter after logging in...")
            time.sleep(2)
            page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=30000)
            time.sleep(3)
            self._dismiss_popups()
            if not self._is_logged_in():
                raise RuntimeError(
                    "Facebook login not detected. Run again and log in manually."
                )
        else:
            logger.info("Facebook: logged in (session reused).")

    def _is_logged_in(self) -> bool:
        try:
            url = self._page.url.lower()
            if "login" in url:
                return False
            content = self._page.content()
            for indicator in ('id="email"', 'name="login"', "Log Into Facebook"):
                if indicator in content:
                    return False
            for sel in (
                '[aria-label="Your profile"]',
                '[aria-label="Account"]',
                'div[role="navigation"]',
            ):
                if self._page.query_selector(sel):
                    return True
        except Exception:
            pass
        return False

    def _dismiss_popups(self) -> None:
        selectors = [
            'button[data-cookiebanner="accept_button"]',
            '[aria-label="Allow all cookies"]',
            '[aria-label="Decline optional cookies"]',
            'div[role="dialog"] [aria-label="Close"]',
            'div[role="dialog"] button:has-text("Not Now")',
            'div[role="dialog"] button:has-text("Not now")',
        ]
        for sel in selectors:
            try:
                btn = self._page.query_selector(sel)
                if btn and btn.is_visible():
                    btn.click()
                    time.sleep(random.uniform(0.5, 1.5))
            except Exception:
                pass

    def _detect_block(self) -> str | None:
        try:
            url = self._page.url.lower()
            for flag in ("/checkpoint", "/security/", "captcha", "/challenge/"):
                if flag in url:
                    return f"checkpoint_url:{flag}"
            text = self._page.inner_text("body").lower()
            signals = [
                ("you're temporarily blocked", "temp_blocked"),
                ("action blocked", "action_blocked"),
                ("please try again later", "rate_limited"),
                ("confirm your identity", "identity_check"),
                ("security check", "security_check"),
            ]
            for phrase, label in signals:
                if phrase in text:
                    return label
        except Exception:
            pass
        return None

    def _in_header(self, page, el) -> bool:
        """Return True if element is in the top 600px of the page (profile header area)."""
        try:
            box = el.bounding_box()
            if box is None:
                return False
            scroll_y = page.evaluate("window.scrollY")
            return (box["y"] + scroll_y) < 600
        except Exception:
            return False

    def _human_delay(self) -> None:
        delay = max(
            self.delay_min,
            min(self.delay_max, random.lognormvariate(math.log(30), 0.5)),
        )
        time.sleep(delay)

    def _short_delay(self) -> None:
        time.sleep(random.uniform(2, 5))

    @staticmethod
    def _dry_print(msg: str) -> None:
        print("\n" + "=" * 60)
        print(f"[DRY-RUN] {msg}")
        print("=" * 60 + "\n")
