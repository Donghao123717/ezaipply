"""
Memory tool: manages operational state (seen media, rate limits) and comment logs.

Files:
    memory/state.json       — replied media IDs, daily counters
    memory/comment_log.json — full history of all generated comments/posts
"""
from __future__ import annotations

import copy
import json
import logging
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_BASE = Path(__file__).parent.parent / "memory"
STATE_PATH = _BASE / "state.json"
COMMENT_LOG_PATH = _BASE / "comment_log.json"

_DEFAULT_STATE = {
    "commented_media_ids": [],
    "replied_comment_ids": [],
    "followed_usernames": [],
    "daily_comment_count": 0,
    "daily_post_count": 0,
    "daily_follow_count": 0,
    "last_reset_date": "",
}


class MemoryTool:
    """Read/write wrapper for state.json and comment_log.json."""

    def __init__(
        self,
        state_path: Path = STATE_PATH,
        comment_log_path: Path = COMMENT_LOG_PATH,
    ):
        self._state_path = state_path
        self._comment_log_path = comment_log_path
        _BASE.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # State helpers
    # ------------------------------------------------------------------

    def load_state(self) -> dict:
        state = _read_json(self._state_path, copy.deepcopy(_DEFAULT_STATE))
        state = self._maybe_reset_daily_counters(state)
        return state

    def save_state(self, state: dict) -> None:
        _write_json(self._state_path, state)

    def has_commented(self, media_id: str) -> bool:
        """Return True if we have already commented on this media ID."""
        state = self.load_state()
        return media_id in state.get("commented_media_ids", [])

    def mark_commented(self, media_id: str) -> None:
        """Record that we commented on a media and increment daily counter."""
        state = self.load_state()
        if media_id not in state["commented_media_ids"]:
            state["commented_media_ids"].append(media_id)
        state["daily_comment_count"] = state.get("daily_comment_count", 0) + 1
        self.save_state(state)

    def has_replied_to_comment(self, comment_id: str) -> bool:
        """Return True if we have already replied to this comment ID."""
        state = self.load_state()
        return comment_id in state.get("replied_comment_ids", [])

    def mark_replied_to_comment(self, comment_id: str) -> None:
        """Record that we replied to a comment."""
        state = self.load_state()
        if comment_id not in state.setdefault("replied_comment_ids", []):
            state["replied_comment_ids"].append(comment_id)
        self.save_state(state)

    def increment_post_count(self) -> None:
        state = self.load_state()
        state["daily_post_count"] = state.get("daily_post_count", 0) + 1
        self.save_state(state)

    def has_followed(self, username: str) -> bool:
        """Return True if we have already followed this username."""
        state = self.load_state()
        return username in state.get("followed_usernames", [])

    def mark_followed(self, username: str) -> None:
        """Record that we followed a user and increment daily counter."""
        state = self.load_state()
        if username not in state.setdefault("followed_usernames", []):
            state["followed_usernames"].append(username)
        state["daily_follow_count"] = state.get("daily_follow_count", 0) + 1
        self.save_state(state)

    def daily_comment_count(self) -> int:
        return self.load_state().get("daily_comment_count", 0)

    def daily_post_count(self) -> int:
        return self.load_state().get("daily_post_count", 0)

    def daily_follow_count(self) -> int:
        return self.load_state().get("daily_follow_count", 0)

    # ------------------------------------------------------------------
    # Comment log helpers
    # ------------------------------------------------------------------

    def log_entry(self, entry: dict[str, Any]) -> None:
        """Append a comment/post record to comment_log.json."""
        log = _read_json(self._comment_log_path, [])
        entry.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
        log.append(entry)
        _write_json(self._comment_log_path, log)

    def load_comment_log(self) -> list[dict]:
        return _read_json(self._comment_log_path, [])

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _maybe_reset_daily_counters(self, state: dict) -> dict:
        today = date.today().isoformat()
        if state.get("last_reset_date") != today:
            state["daily_comment_count"] = 0
            state["daily_post_count"] = 0
            state["daily_follow_count"] = 0
            state["last_reset_date"] = today
            self.save_state(state)
        return state


# ------------------------------------------------------------------
# Module-level helpers
# ------------------------------------------------------------------

def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        logger.warning("Could not read %s, using default.", path)
        return default


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))
