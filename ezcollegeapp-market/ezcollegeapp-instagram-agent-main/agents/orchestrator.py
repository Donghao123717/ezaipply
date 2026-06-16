"""
Orchestrator: central coordinator for the instagrapi-only automation flow.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import yaml  # type: ignore
from dotenv import load_dotenv  # type: ignore

from agents.comment_agent import CommentAgent
from agents.dm_agent import DMAgent
from agents.follow_agent import FollowAgent
from agents.post_agent import PostAgent
from agents.reply_agent import ReplyAgent
from tools.instagrapi_tool import InstagrapiTool
from tools.llm_client import LLMClient
from tools.memory_tool import MemoryTool

load_dotenv()
logger = logging.getLogger(__name__)

_SETTINGS_PATH = Path(__file__).parent.parent / "config" / "settings.yaml"


class Orchestrator:
    """
    Instagrapi-only orchestrator for four actions:
      - post
      - dm
      - comment
      - reply

    Each action exposes explicit mode split methods:
      - *_manual
      - *_llm
    """

    def __init__(self, settings_path: Path = _SETTINGS_PATH):
        self.cfg = self._load_settings(settings_path)
        provider = os.getenv("LLM_PROVIDER") or self.cfg["llm"]["provider"]
        model = self._resolve_model(provider)

        self.llm = LLMClient(provider=provider, model=model)
        self.memory = MemoryTool()
        self.instagrapi = InstagrapiTool(
            dry_run=_resolve_bool("DRY_RUN", self.cfg.get("dry_run", True))
        )

        rate = self.cfg.get("rate_limits", {})
        self.post_agent = PostAgent(
            llm=self.llm,
            instagrapi=self.instagrapi,
            memory=self.memory,
            max_daily_posts=rate.get("max_posts_per_day", 2),
        )
        self.comment_agent = CommentAgent(
            llm=self.llm,
            instagrapi=self.instagrapi,
            memory=self.memory,
            max_daily_comments=rate.get("max_comments_per_day", 15),
        )
        self.reply_agent = ReplyAgent(
            llm=self.llm,
            instagrapi=self.instagrapi,
            memory=self.memory,
            max_replies_per_run=rate.get("max_replies_per_run", 10),
        )
        self.dm_agent = DMAgent(
            llm=self.llm,
            instagrapi=self.instagrapi,
            memory=self.memory,
        )
        follow_rate = rate.get("follow", {})
        active_hours_cfg = follow_rate.get("active_hours")
        self.follow_agent = FollowAgent(
            instagrapi=self.instagrapi,
            memory=self.memory,
            min_per_day=follow_rate.get("min_per_day", 20),
            max_per_day=follow_rate.get("max_per_day", 40),
            delay_min=follow_rate.get("delay_seconds_min", 15),
            delay_max=follow_rate.get("delay_seconds_max", 45),
            active_hours=tuple(active_hours_cfg) if active_hours_cfg else None,
        )

    # ------------------------------------------------------------------
    # Post
    # ------------------------------------------------------------------

    def post_manual(self, media_path_or_url: str, caption: str) -> str:
        return self.post_agent.post_manual(media_path_or_url=media_path_or_url, caption=caption)

    def post_llm(self, media_path_or_url: str, post_format: str = "story", extra_context: str = "") -> str:
        return self.post_agent.post_llm(
            media_path_or_url=media_path_or_url,
            post_format=post_format,
            extra_context=extra_context,
        )

    # ------------------------------------------------------------------
    # DM
    # ------------------------------------------------------------------

    def dm_manual(self, username: str, text: str) -> str:
        return self.dm_agent.dm_manual(username=username, text=text)

    def dm_llm(self, username: str, materials: str, extra_context: str = "") -> str:
        return self.dm_agent.dm_llm(
            username=username,
            materials=materials,
            extra_context=extra_context,
        )

    # ------------------------------------------------------------------
    # Comment
    # ------------------------------------------------------------------

    def comment_manual(self, post_url: str, text: str) -> str:
        return self.comment_agent.comment_manual(post_url=post_url, text=text)

    def comment_llm(self, post_url: str, extra_context: str = "") -> str:
        return self.comment_agent.comment_llm(post_url=post_url, extra_context=extra_context)

    # ------------------------------------------------------------------
    # Reply
    # ------------------------------------------------------------------

    def reply_manual(self, username: str, manual_replies: dict[str, str], post_url: str = "") -> int:
        return self.reply_agent.reply_manual(
            username=username,
            manual_replies=manual_replies,
            post_url=post_url,
        )

    def reply_llm(self, username: str, post_url: str = "", extra_context: str = "") -> int:
        return self.reply_agent.reply_llm(
            username=username,
            post_url=post_url,
            extra_context=extra_context,
        )

    # ------------------------------------------------------------------
    # Follow
    # ------------------------------------------------------------------

    def follow_batch(self, usernames: list[str]) -> int:
        return self.follow_agent.follow_batch(usernames=usernames)

    # ------------------------------------------------------------------
    # Job runner
    # ------------------------------------------------------------------

    def run_job(self, job_path: str, mode_override: str = "") -> dict[str, Any]:
        job = self._load_job(job_path)
        mode = (mode_override or job.get("mode", "manual")).strip().lower()
        if mode not in ("manual", "llm"):
            raise ValueError("mode must be 'manual' or 'llm'")

        summary: dict[str, Any] = {"mode": mode, "results": {}}

        post_cfg = job.get("post", {})
        if post_cfg.get("enabled", False):
            if mode == "manual":
                caption = self.post_manual(
                    media_path_or_url=post_cfg["media"],
                    caption=post_cfg["caption"],
                )
            else:
                caption = self.post_llm(
                    media_path_or_url=post_cfg["media"],
                    post_format=post_cfg.get("post_format", "story"),
                    extra_context=post_cfg.get("extra_context", ""),
                )
            summary["results"]["post"] = {"ok": True, "caption": caption}

        dm_cfg = job.get("dm", {})
        if dm_cfg.get("enabled", False):
            recipient_results = []
            for rec in dm_cfg.get("recipients", []):
                username = rec["username"]
                if mode == "manual":
                    text = self.dm_manual(username=username, text=rec["text"])
                else:
                    text = self.dm_llm(
                        username=username,
                        materials=rec.get("materials", dm_cfg.get("materials", "")),
                        extra_context=rec.get("extra_context", dm_cfg.get("extra_context", "")),
                    )
                recipient_results.append({"username": username, "text": text})
            summary["results"]["dm"] = {"ok": True, "sent": recipient_results}

        comment_cfg = job.get("comment", {})
        if comment_cfg.get("enabled", False):
            if mode == "manual":
                text = self.comment_manual(
                    post_url=comment_cfg["post_url"],
                    text=comment_cfg["text"],
                )
            else:
                text = self.comment_llm(
                    post_url=comment_cfg["post_url"],
                    extra_context=comment_cfg.get("extra_context", ""),
                )
            summary["results"]["comment"] = {"ok": True, "text": text}

        reply_cfg = job.get("reply", {})
        if reply_cfg.get("enabled", False):
            username = reply_cfg["username"]
            post_url = reply_cfg.get("post_url", "")
            if mode == "manual":
                manual_replies = {
                    item["comment_id"]: item["text"] for item in reply_cfg.get("manual_replies", [])
                }
                count = self.reply_manual(
                    username=username,
                    post_url=post_url,
                    manual_replies=manual_replies,
                )
            else:
                count = self.reply_llm(
                    username=username,
                    post_url=post_url,
                    extra_context=reply_cfg.get("extra_context", ""),
                )
            summary["results"]["reply"] = {"ok": True, "count": count}

        follow_cfg = job.get("follow", {})
        if follow_cfg.get("enabled", False):
            accounts = self._load_follow_accounts(follow_cfg)
            count = self.follow_batch(accounts)
            summary["results"]["follow"] = {"ok": True, "count": count}

        return summary

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _load_settings(path: Path) -> dict[str, Any]:
        with path.open() as f:
            return yaml.safe_load(f)

    @staticmethod
    def _load_job(path: str) -> dict[str, Any]:
        job_file = Path(path).expanduser().resolve()
        if not job_file.exists():
            raise FileNotFoundError(f"Job file not found: {job_file}")
        with job_file.open() as f:
            return yaml.safe_load(f)

    @staticmethod
    def _load_follow_accounts(follow_cfg: dict) -> list[str]:
        accounts_file = follow_cfg.get("accounts_file", "")
        if accounts_file:
            path = Path(accounts_file).expanduser().resolve()
            with path.open() as f:
                data = yaml.safe_load(f) or {}
            return [str(u) for u in data.get("accounts", [])]
        return [str(u) for u in follow_cfg.get("accounts", [])]

    def _resolve_model(self, provider: str) -> str:
        llm_cfg = self.cfg.get("llm", {})
        if provider == "openai":
            return llm_cfg.get("openai_model", "gpt-4o")
        if provider == "gemini":
            return llm_cfg.get("gemini_model", "gemini-1.5-pro")
        return ""


def _resolve_bool(env_key: str, config_default: bool) -> bool:
    val = os.getenv(env_key, "").lower()
    if val in ("true", "1", "yes"):
        return True
    if val in ("false", "0", "no"):
        return False
    return config_default
