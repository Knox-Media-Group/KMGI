"""
MusicPipeline — high-level entry point with weekly scheduling.

Wraps IngestWorker with a scheduler that runs the job on a
configurable weekly cadence. Supports one-shot mode for manual /
CI runs.
"""

import signal
import logging
import sys
import time
from datetime import datetime
from typing import Optional

from .config import MusicConfig
from .worker import IngestWorker, IngestResult
from .audit import AuditLogger

logger = logging.getLogger(__name__)


class MusicPipeline:
    """
    Top-level pipeline with weekly scheduling.

    Usage::

        config = MusicConfig.from_yaml("opx_music_config.yaml")
        pipeline = MusicPipeline(config)

        # One-shot
        result = pipeline.run_once()

        # Scheduled daemon
        pipeline.run_scheduled()
    """

    def __init__(self, config: MusicConfig):
        self.config = config
        self.worker = IngestWorker(config)
        self.audit = AuditLogger(config.audit_log_path)

    # ------------------------------------------------------------------
    # One-shot
    # ------------------------------------------------------------------

    def run_once(self, since: str = None) -> IngestResult:
        """Run a single ingestion pass and return the result."""
        logger.info("pipeline_run_once | since=%s", since)
        return self.worker.run(since=since)

    # ------------------------------------------------------------------
    # Scheduled
    # ------------------------------------------------------------------

    def run_scheduled(self):
        """
        Start the weekly scheduler and block until interrupted.

        Uses the ``schedule`` library to fire the ingest job on the
        configured day/time each week.
        """
        try:
            import schedule
        except ImportError:
            logger.error("'schedule' package required. Install with: pip install schedule")
            sys.exit(1)

        day = self.config.schedule.cron_day.lower()
        time_str = self.config.schedule.cron_time

        # Map day string to schedule method
        day_map = {
            "monday": schedule.every().monday,
            "tuesday": schedule.every().tuesday,
            "wednesday": schedule.every().wednesday,
            "thursday": schedule.every().thursday,
            "friday": schedule.every().friday,
            "saturday": schedule.every().saturday,
            "sunday": schedule.every().sunday,
        }

        scheduler = day_map.get(day)
        if scheduler is None:
            logger.error("Invalid schedule day: %s", day)
            sys.exit(1)

        scheduler.at(time_str).do(self._scheduled_job)

        logger.info(
            "pipeline_scheduler_start | day=%s time=%s",
            day, time_str,
        )

        if self.config.schedule.run_on_start:
            logger.info("pipeline_run_on_start")
            self._scheduled_job()

        running = True

        def _shutdown(signum, frame):
            nonlocal running
            logger.info("pipeline_shutdown_signal | signal=%s", signum)
            running = False

        signal.signal(signal.SIGINT, _shutdown)
        signal.signal(signal.SIGTERM, _shutdown)

        while running:
            schedule.run_pending()
            time.sleep(60)

        logger.info("pipeline_scheduler_stopped")

    def _scheduled_job(self):
        """Callback invoked by the scheduler."""
        logger.info("pipeline_scheduled_job_trigger | time=%s", datetime.now().isoformat())
        try:
            result = self.worker.run()
            if result.status == "completed":
                logger.info("weekly job done: %s", result.summary_line())
            else:
                logger.error("weekly job failed: %s", result.summary_line())
        except Exception as exc:
            logger.exception("pipeline_scheduled_job_exception | error=%s", exc)
