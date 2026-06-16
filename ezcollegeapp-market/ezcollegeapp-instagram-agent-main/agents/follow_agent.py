"""
Follow Agent: follows a batch of Instagram accounts per day, randomizing
count and inter-follow delays to reduce ban risk.
"""
from __future__ import annotations

import logging
import random
import time
from datetime import datetime, timezone

from tools.instagrapi_tool import InstagrapiTool
from tools.memory_tool import MemoryTool

logger = logging.getLogger(__name__)


class FollowAgent:
    """
    Follows a batch of Instagram accounts from a provided username list.

    Anti-ban measures:
      - Randomized follow count per run (between min_per_day and max_per_day)
      - Random delay between each follow call
      - Deduplication: never follows the same account twice
      - Daily cap: stops once the day's max is reached
      - Optional active-hours guard: skips the run outside configured hours
    """

    def __init__(
        self,
        instagrapi: InstagrapiTool,
        memory: MemoryTool,
        min_per_day: int = 20,
        max_per_day: int = 40,
        delay_min: int = 15,
        delay_max: int = 45,
        active_hours: tuple[int, int] | None = None,
    ):
        self.instagrapi = instagrapi
        self.memory = memory
        self.min_per_day = min_per_day
        self.max_per_day = max_per_day
        self.delay_min = delay_min
        self.delay_max = delay_max
        self.active_hours = active_hours  # (start_hour, end_hour) in 24h local time

    def follow_batch(self, usernames: list[str]) -> int:
        """
        Follow accounts from the provided list, respecting rate limits and dedup.

        Args:
            usernames: List of Instagram usernames to follow.

        Returns:
            Number of accounts followed this run.
        """
        if self.active_hours:
            current_hour = datetime.now().hour
            start, end = self.active_hours
            if not (start <= current_hour < end):
                logger.info(
                    "Outside active hours (%d:00–%d:00). Skipping follow run.",
                    start,
                    end,
                )
                return 0

        pending = [u for u in usernames if not self.memory.has_followed(u)]
        if not pending:
            logger.info("All accounts in list already followed.")
            return 0

        already_today = self.memory.daily_follow_count()
        remaining_budget = self.max_per_day - already_today
        if remaining_budget <= 0:
            logger.info("Daily follow limit reached (%d). Skipping.", self.max_per_day)
            return 0

        target = random.randint(self.min_per_day, self.max_per_day)
        target = min(target, remaining_budget, len(pending))

        # Shuffle so we don't always process the list top-to-bottom
        batch = random.sample(pending, target)

        followed = 0
        for i, username in enumerate(batch):
            ok = self.instagrapi.follow_user(username)
            if ok and not self.instagrapi.dry_run:
                self.memory.mark_followed(username)
                self.memory.log_entry(
                    {
                        "type": "follow",
                        "username": username,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
                followed += 1
                logger.info(
                    "Followed @%s (%d/%d this run)", username, followed, target
                )

            if i < len(batch) - 1:
                delay = random.randint(self.delay_min, self.delay_max)
                logger.debug("Waiting %ds before next follow...", delay)
                time.sleep(delay)

        logger.info("Follow batch complete. Followed %d account(s).", followed)
        return followed
