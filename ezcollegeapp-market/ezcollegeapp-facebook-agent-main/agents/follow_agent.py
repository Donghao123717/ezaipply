"""
Follow Agent: follows a batch of Facebook pages/profiles per day.
"""
from __future__ import annotations

import logging
import random
import time
from datetime import datetime, timezone

from tools.playwright_tool import PlaywrightTool
from tools.memory_tool import MemoryTool

logger = logging.getLogger(__name__)


class FollowAgent:
    """
    Follows a batch of Facebook pages from a provided list.

    Anti-ban measures:
      - Randomized follow count per run (min_per_day – max_per_day)
      - Random delay between each follow
      - Deduplication: never follows the same account twice
      - Daily cap: stops once the day's max is reached
      - Optional active-hours guard
    """

    def __init__(
        self,
        playwright: PlaywrightTool,
        memory: MemoryTool,
        min_per_day: int = 20,
        max_per_day: int = 40,
        delay_min: int = 15,
        delay_max: int = 45,
        active_hours: tuple[int, int] | None = None,
    ):
        self.playwright = playwright
        self.memory = memory
        self.min_per_day = min_per_day
        self.max_per_day = max_per_day
        self.delay_min = delay_min
        self.delay_max = delay_max
        self.active_hours = active_hours

    def follow_batch(self, page_ids: list[str]) -> dict[str, int]:
        """
        Follow pages/accounts from the provided list, respecting rate limits and dedup.

        Clicks Follow for pages and public figures, Add Friend for personal accounts.

        Returns:
            {"followed": n, "friend_requested": m}
        """
        if self.active_hours:
            current_hour = datetime.now().hour
            start, end = self.active_hours
            if not (start <= current_hour < end):
                logger.info(
                    "Outside active hours (%d:00–%d:00). Skipping follow run.", start, end
                )
                return {"followed": 0, "friend_requested": 0}

        pending = [
            p for p in page_ids
            if not self.memory.has_followed(p) and not self.memory.has_friend_requested(p)
        ]
        if not pending:
            logger.info("All accounts in list already followed or friend-requested.")
            return {"followed": 0, "friend_requested": 0}

        already_today = self.memory.daily_follow_count() + self.memory.daily_friend_request_count()
        remaining_budget = self.max_per_day - already_today
        if remaining_budget <= 0:
            logger.info("Daily follow limit reached (%d). Skipping.", self.max_per_day)
            return {"followed": 0, "friend_requested": 0}

        target = random.randint(self.min_per_day, self.max_per_day)
        target = min(target, remaining_budget, len(pending))

        batch = random.sample(pending, target)

        followed_count = 0
        friend_request_count = 0

        for i, page_id in enumerate(batch):
            result = self.playwright.follow_user(page_id)
            if result and not self.playwright.dry_run:
                if result == "followed":
                    self.memory.mark_followed(page_id)
                    self.memory.log_entry({
                        "type": "follow",
                        "page_id": page_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    followed_count += 1
                    logger.info("Followed @%s (%d follows this run)", page_id, followed_count)
                elif result == "friend_requested":
                    self.memory.mark_friend_requested(page_id)
                    self.memory.log_entry({
                        "type": "friend_request",
                        "page_id": page_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    friend_request_count += 1
                    logger.info("Friend-requested @%s (%d requests this run)", page_id, friend_request_count)
            elif result:  # dry_run=True — result is True, type unknown
                followed_count += 1

            if i < len(batch) - 1:
                delay = random.randint(self.delay_min, self.delay_max)
                logger.debug("Waiting %ds before next action...", delay)
                time.sleep(delay)

        logger.info(
            "Follow batch complete. Followed %d page(s), sent %d friend request(s).",
            followed_count, friend_request_count,
        )
        return {"followed": followed_count, "friend_requested": friend_request_count}
