"""
InstagrapiTool: uses the unofficial instagrapi library to interact with Instagram
using a personal account. Supports fetching a post's comments and replying to them.

WARNING: This uses Instagram's private mobile API, which violates Instagram's Terms
of Service. Account action blocks or permanent bans are possible. Use only on accounts
you are willing to lose, and keep activity volumes low.

Required env vars:
  INSTAGRAPI_USERNAME   Your Instagram username
  INSTAGRAPI_PASSWORD   Your Instagram password
"""
from __future__ import annotations

import logging
import mimetypes
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

_SESSION_PATH = Path(__file__).parent.parent / "memory" / "ig_session.json"


@dataclass
class IGCommentData:
    """A top-level comment on an Instagram post."""
    comment_id: str
    text: str
    username: str
    media_id: str


class InstagrapiTool:
    """
    Thin wrapper around instagrapi.Client.

    Read operations (get_post_*, get_comments) run in all modes.
    Write operations are guarded by dry_run.
    """

    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run
        self._client = None  # lazy — only created on first real call

    # ------------------------------------------------------------------
    # Public: reads
    # ------------------------------------------------------------------

    def get_post_by_url(self, url: str) -> tuple[str, str, str] | None:
        """
        Return (media_id, permalink, caption) for a post URL.
        Returns None on failure.
        """
        cl = self._get_client()
        try:
            media_pk = cl.media_pk_from_url(url)
            media = cl.media_info(media_pk)
            caption = media.caption_text or ""
            return str(media_pk), url, caption
        except Exception as exc:
            logger.error("Failed to fetch post from URL %s: %s", url, exc)
            return None

    def get_latest_post(self, username: str) -> tuple[str, str, str] | None:
        """
        Return (media_id, permalink, caption) for a user's most recent post.
        Returns None if the user has no posts or the account is not found.
        """
        cl = self._get_client()
        try:
            user_id = cl.user_id_from_username(username)
            medias = cl.user_medias(user_id, amount=1)
            if not medias:
                logger.warning("No posts found for @%s", username)
                return None
            media = medias[0]
            permalink = f"https://www.instagram.com/p/{media.code}/"
            caption = media.caption_text or ""
            return str(media.pk), permalink, caption
        except Exception as exc:
            logger.error("Failed to fetch latest post for @%s: %s", username, exc)
            return None

    def get_comments(self, media_id: str, limit: int = 50) -> list[IGCommentData]:
        """
        Return top-level comments on a post.
        Runs in both dry-run and live mode (reads are always allowed).
        """
        cl = self._get_client()
        try:
            comments = cl.media_comments(media_id, amount=limit)
            return [
                IGCommentData(
                    comment_id=str(c.pk),
                    text=c.text,
                    username=c.user.username,
                    media_id=media_id,
                )
                for c in comments
            ]
        except Exception as exc:
            logger.error("Failed to fetch comments for media %s: %s", media_id, exc)
            return []

    # ------------------------------------------------------------------
    # Public: writes
    # ------------------------------------------------------------------

    def post_comment(self, media_id: str, text: str) -> str | None:
        """
        Add a top-level comment to a post.

        In dry-run mode prints the comment instead of posting.

        Returns:
            New comment ID on success, None on failure.
        """
        if self.dry_run:
            print("\n" + "=" * 60)
            print(f"[DRY-RUN] Would add top-level comment on media {media_id}:")
            print("-" * 60)
            print(text)
            print("=" * 60 + "\n")
            return "dry_run_comment_id"

        cl = self._get_client()
        try:
            comment = cl.media_comment(media_id, text)
            comment_id = str(comment.pk)
            logger.info("Posted top-level comment %s on media %s", comment_id, media_id)
            return comment_id
        except Exception as exc:
            logger.error("Failed to add top-level comment on media %s: %s", media_id, exc)
            return None

    def post_comment_by_url(self, post_url: str, text: str) -> str | None:
        """
        Add a top-level comment to a post URL.

        Returns:
            New comment ID on success, None on failure.
        """
        post_info = self.get_post_by_url(post_url)
        if post_info is None:
            return None

        media_id, _permalink, _caption = post_info
        return self.post_comment(media_id=media_id, text=text)

    def reply_to_comment(
        self,
        media_id: str,
        comment_id: str,
        text: str,
    ) -> str | None:
        """
        Reply to a comment on a post.

        In dry-run mode prints the reply instead of posting.

        Returns:
            New reply comment ID on success, None on failure.
        """
        if self.dry_run:
            print("\n" + "=" * 60)
            print(f"[DRY-RUN] Would reply to comment {comment_id} on media {media_id}:")
            print("-" * 60)
            print(text)
            print("=" * 60 + "\n")
            return "dry_run_reply_id"

        cl = self._get_client()
        try:
            reply = cl.media_comment(
                media_id,
                text,
                replied_to_comment_id=int(comment_id),
            )
            reply_id = str(reply.pk)
            logger.info("Posted reply %s to comment %s", reply_id, comment_id)
            return reply_id
        except Exception as exc:
            logger.error("Failed to reply to comment %s: %s", comment_id, exc)
            return None

    def publish_media_post(self, media_path_or_url: str, caption: str) -> str | None:
        """
        Publish a feed post from a local path or URL.

        Supports images and videos. URLs are downloaded to a temp file.

        Returns:
            New media ID on success, None on failure.
        """
        if self.dry_run:
            print("\n" + "=" * 60)
            print("[DRY-RUN] Would publish a media post:")
            print(f"Media: {media_path_or_url}")
            print("-" * 60)
            print(caption)
            print("=" * 60 + "\n")
            return "dry_run_media_id"

        cl = self._get_client()
        local_path, temp_path = self._resolve_media_path(media_path_or_url)
        try:
            if self._is_video(local_path):
                media = cl.video_upload(local_path, caption=caption)
            else:
                media = cl.photo_upload(local_path, caption=caption)
            media_id = str(media.pk)
            logger.info("Published media post %s", media_id)
            return media_id
        except Exception as exc:
            logger.error("Failed to publish media post from %s: %s", media_path_or_url, exc)
            return None
        finally:
            if temp_path and temp_path.exists():
                temp_path.unlink(missing_ok=True)

    def follow_user(self, username: str) -> bool:
        """
        Follow an Instagram user by username.

        In dry-run mode prints the action instead of following.

        Returns:
            True on success, False on failure.
        """
        if self.dry_run:
            print("\n" + "=" * 60)
            print(f"[DRY-RUN] Would follow @{username}")
            print("=" * 60 + "\n")
            return True

        cl = self._get_client()
        try:
            user_id = cl.user_id_from_username(username)
            result = cl.user_follow(user_id)
            logger.info("Followed @%s", username)
            return bool(result)
        except Exception as exc:
            logger.error("Failed to follow @%s: %s", username, exc)
            return False

    def send_dm(self, username: str, text: str) -> str | None:
        """
        Send a direct message to a user by username.

        Returns:
            Thread ID on success, None on failure.
        """
        if self.dry_run:
            print("\n" + "=" * 60)
            print(f"[DRY-RUN] Would send DM to @{username}:")
            print("-" * 60)
            print(text)
            print("=" * 60 + "\n")
            return "dry_run_thread"

        cl = self._get_client()
        try:
            user_id = cl.user_id_from_username(username)
            result = cl.direct_send(text=text, user_ids=[user_id])
            thread_id = str(getattr(result, "thread_id", ""))
            logger.info("Sent DM to @%s (thread=%s)", username, thread_id or "unknown")
            return thread_id or "sent"
        except Exception as exc:
            logger.error("Failed to send DM to @%s: %s", username, exc)
            return None

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _get_client(self):
        if self._client is not None:
            return self._client

        from instagrapi import Client  # type: ignore

        username = os.getenv("INSTAGRAPI_USERNAME", "")
        password = os.getenv("INSTAGRAPI_PASSWORD", "")

        if not username or not password:
            raise EnvironmentError(
                "INSTAGRAPI_USERNAME and INSTAGRAPI_PASSWORD must be set in .env"
            )

        cl = Client()

        # Reuse saved session to avoid triggering login challenges on every run.
        if _SESSION_PATH.exists():
            try:
                cl.load_settings(_SESSION_PATH)
                logger.info("Loaded saved session from %s", _SESSION_PATH)
            except Exception as exc:
                logger.warning("Could not load session file (%s), doing fresh login.", exc)

        cl.login(username, password)

        _SESSION_PATH.parent.mkdir(parents=True, exist_ok=True)
        cl.dump_settings(_SESSION_PATH)
        logger.info("instagrapi: logged in as @%s, session saved.", username)

        self._client = cl
        return cl

    def _resolve_media_path(self, media_path_or_url: str) -> tuple[str, Path | None]:
        if media_path_or_url.startswith("http://") or media_path_or_url.startswith("https://"):
            suffix = _suffix_from_url(media_path_or_url)
            with requests.get(media_path_or_url, timeout=30) as resp:
                resp.raise_for_status()
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    tmp.write(resp.content)
                    return tmp.name, Path(tmp.name)

        path = Path(media_path_or_url).expanduser().resolve()
        if not path.exists():
            raise FileNotFoundError(f"Media file not found: {path}")
        return str(path), None

    @staticmethod
    def _is_video(path: str) -> bool:
        mime, _ = mimetypes.guess_type(path)
        return bool(mime and mime.startswith("video/"))


def _suffix_from_url(url: str) -> str:
    parsed = Path(url.split("?", 1)[0])
    if parsed.suffix:
        return parsed.suffix
    return ".jpg"
