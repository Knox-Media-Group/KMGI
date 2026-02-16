"""
Publish audit logger.

Writes a structured, append-only audit log for every track that is
published (routed to a WMXV folder). Each entry records the track ID,
metadata snapshot, classification, destination path, and timestamp.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from .exceptions import AuditError

logger = logging.getLogger(__name__)


class AuditLogger:
    """Append-only audit log for published tracks."""

    def __init__(self, log_path: str):
        self._log_path = Path(log_path)
        self._log_path.parent.mkdir(parents=True, exist_ok=True)

    def log_publish(
        self,
        track_id: str,
        title: str,
        artist: str,
        classification: str,
        dest_path: str,
        metadata: Dict[str, Any] = None,
    ):
        """
        Write a single publish audit entry.

        Args:
            track_id: Unique track identifier.
            title: Track title.
            artist: Track artist.
            classification: WMXV classification (e.g. "Hot Rap").
            dest_path: Final publish folder path.
            metadata: Optional full metadata snapshot.
        """
        entry = {
            "timestamp": datetime.now().isoformat(),
            "event": "track_published",
            "track_id": track_id,
            "title": title,
            "artist": artist,
            "classification": classification,
            "dest_path": dest_path,
        }
        if metadata:
            entry["metadata"] = metadata

        try:
            with open(self._log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except OSError as exc:
            raise AuditError(f"Failed to write audit entry: {exc}")

        logger.info(
            "audit_published | track_id=%s title=%r classification=%s dest=%s",
            track_id, title, classification, dest_path,
        )

    def log_event(self, event: str, details: Dict[str, Any] = None):
        """Write a generic audit event (job start, job end, errors, etc.)."""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "event": event,
        }
        if details:
            entry.update(details)

        try:
            with open(self._log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except OSError as exc:
            raise AuditError(f"Failed to write audit event: {exc}")

    def read_log(self, limit: int = None) -> List[Dict[str, Any]]:
        """Read audit log entries, most recent last."""
        if not self._log_path.exists():
            return []

        entries = []
        with open(self._log_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

        if limit:
            return entries[-limit:]
        return entries

    def get_published_count(self, classification: str = None) -> int:
        """Count published entries, optionally filtered by classification."""
        entries = self.read_log()
        count = 0
        for entry in entries:
            if entry.get("event") != "track_published":
                continue
            if classification and entry.get("classification") != classification:
                continue
            count += 1
        return count

    def get_last_job_summary(self) -> Optional[Dict[str, Any]]:
        """Get the most recent job_complete event."""
        entries = self.read_log()
        for entry in reversed(entries):
            if entry.get("event") == "job_complete":
                return entry
        return None
