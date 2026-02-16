"""
Ingest worker — orchestrates the full music ingestion pipeline.

Pipeline stages:
  1. Source pull  — connect to music server, list + download new tracks
  2. Ingest       — stage downloaded files for processing
  3. Metadata     — extract / normalize track metadata
  4. Classify     — assign WMXV category (e.g. "Hot Rap")
  5. Route        — copy file to the correct WMXV publish folder
  6. Audit        — write publish audit log entry

The worker tracks per-run statistics and emits structured log lines
at every stage so operators can trace exactly what happened.
"""

import json
import logging
from datetime import datetime
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import List, Dict, Any, Optional

from .config import MusicConfig
from .source import MusicSourceClient
from .metadata import extract_metadata, TrackMeta
from .classifier import classify_track
from .router import WMXVRouter
from .audit import AuditLogger
from .exceptions import (
    OPXMusicError,
    SourceConnectionError,
    SourceAuthError,
    DownloadError,
    MetadataError,
    ClassificationError,
    RoutingError,
    AuditError,
)

logger = logging.getLogger(__name__)


@dataclass
class IngestResult:
    """Result of a single ingest run."""
    status: str = "pending"  # pending | running | completed | failed
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    duration_seconds: float = 0.0

    tracks_listed: int = 0
    tracks_downloaded: int = 0
    tracks_ingested: int = 0
    tracks_classified: int = 0
    tracks_routed: int = 0
    tracks_published: int = 0
    tracks_failed: int = 0
    tracks_skipped: int = 0

    errors: List[str] = field(default_factory=list)
    routed_details: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def summary_line(self) -> str:
        return (
            f"status={self.status} "
            f"ingested={self.tracks_ingested} "
            f"classified={self.tracks_classified} "
            f"routed={self.tracks_routed} "
            f"failed={self.tracks_failed} "
            f"duration={self.duration_seconds:.1f}s"
        )


class IngestWorker:
    """
    Runs the full music ingestion pipeline.

    Usage::

        config = MusicConfig.from_yaml("opx_music_config.yaml")
        worker = IngestWorker(config)
        result = worker.run()
        print(result.summary_line())
    """

    def __init__(self, config: MusicConfig):
        self.config = config
        self.source = MusicSourceClient(config.source)
        self.router = WMXVRouter(config.wmxv)
        self.audit = AuditLogger(config.audit_log_path)
        self._state_path = Path(config.state_path)

    # ------------------------------------------------------------------
    # State persistence (tracks last successful run time)
    # ------------------------------------------------------------------

    def _load_state(self) -> Dict[str, Any]:
        if self._state_path.exists():
            try:
                with open(self._state_path, "r") as f:
                    return json.load(f)
            except (json.JSONDecodeError, OSError):
                pass
        return {}

    def _save_state(self, state: Dict[str, Any]):
        self._state_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._state_path, "w") as f:
            json.dump(state, f, indent=2)

    # ------------------------------------------------------------------
    # Pipeline execution
    # ------------------------------------------------------------------

    def run(self, since: str = None) -> IngestResult:
        """
        Execute the full ingestion pipeline.

        Args:
            since: Optional ISO datetime — only ingest tracks newer than this.
                   If not given, uses the timestamp from the last successful run.

        Returns:
            IngestResult with full statistics.
        """
        result = IngestResult(status="running", started_at=datetime.now().isoformat())
        start = datetime.now()

        self.audit.log_event("job_start", {"since": since})
        logger.info("ingest_job_start | since=%s", since)

        try:
            # Resolve "since" from state if not provided
            if since is None:
                state = self._load_state()
                since = state.get("last_success")

            # ------- Stage 1: Source pull -------
            logger.info("stage_source_pull_start")
            if not self.source.test_connection():
                raise SourceConnectionError(
                    "Cannot reach music server",
                    url=self.config.source.server_url,
                )
            self.source.authenticate()

            tracks = self.source.list_tracks(since=since)
            result.tracks_listed = len(tracks)
            logger.info("stage_source_pull_done | tracks_listed=%d", len(tracks))

            if not tracks:
                logger.info("ingest_no_new_tracks | since=%s", since)
                result.status = "completed"
                result.tracks_skipped = 0
                self._finalize(result, start)
                return result

            # ------- Stage 2: Download / Ingest -------
            logger.info("stage_download_start | count=%d", len(tracks))
            download_results = self.source.download_tracks(tracks)

            # ------- Ensure publish folders exist -------
            self.router.ensure_folders()

            # ------- Stages 3-6 per track -------
            for dl in download_results:
                track_server_meta = dl["track"]
                track_id = str(track_server_meta.get("id", "unknown"))

                if not dl["success"]:
                    result.tracks_failed += 1
                    result.errors.append(f"download:{track_id}: {dl['error']}")
                    continue

                result.tracks_downloaded += 1
                filepath = dl["path"]

                try:
                    # Stage 3: Metadata extraction
                    meta = extract_metadata(filepath, server_meta=track_server_meta)
                    result.tracks_ingested += 1

                    # Stage 4: Classification
                    classification = classify_track(meta)
                    result.tracks_classified += 1

                    # Stage 5: Route to WMXV folder
                    dest_path = self.router.route_track(
                        source_path=filepath,
                        classification=classification,
                        filename=meta.filename,
                    )
                    result.tracks_routed += 1

                    # Stage 6: Audit log
                    self.audit.log_publish(
                        track_id=meta.track_id,
                        title=meta.title,
                        artist=meta.artist,
                        classification=classification,
                        dest_path=dest_path,
                        metadata=meta.to_dict(),
                    )
                    result.tracks_published += 1

                    result.routed_details.append({
                        "track_id": meta.track_id,
                        "title": meta.title,
                        "artist": meta.artist,
                        "classification": classification,
                        "dest_path": dest_path,
                    })

                except MetadataError as exc:
                    result.tracks_failed += 1
                    result.errors.append(f"metadata:{track_id}: {exc}")
                    logger.error("stage_metadata_failed | track_id=%s error=%s", track_id, exc)

                except ClassificationError as exc:
                    result.tracks_failed += 1
                    result.errors.append(f"classify:{track_id}: {exc}")
                    logger.error("stage_classify_failed | track_id=%s error=%s", track_id, exc)

                except RoutingError as exc:
                    result.tracks_failed += 1
                    result.errors.append(f"route:{track_id}: {exc}")
                    logger.error("stage_route_failed | track_id=%s error=%s", track_id, exc)

                except AuditError as exc:
                    # Track was routed but audit failed — still count as routed
                    result.errors.append(f"audit:{track_id}: {exc}")
                    logger.error("stage_audit_failed | track_id=%s error=%s", track_id, exc)

                except Exception as exc:
                    result.tracks_failed += 1
                    result.errors.append(f"unexpected:{track_id}: {exc}")
                    logger.error("stage_unexpected_error | track_id=%s error=%s", track_id, exc)

            result.status = "completed"

        except SourceAuthError as exc:
            result.status = "failed"
            result.errors.append(f"source_auth: {exc}")
            logger.error("ingest_auth_failed | error=%s", exc)

        except SourceConnectionError as exc:
            result.status = "failed"
            result.errors.append(f"source_connection: {exc}")
            logger.error("ingest_connection_failed | error=%s", exc)

        except Exception as exc:
            result.status = "failed"
            result.errors.append(f"unexpected: {exc}")
            logger.error("ingest_unexpected_error | error=%s", exc)

        self._finalize(result, start)
        return result

    def _finalize(self, result: IngestResult, start: datetime):
        """Persist state and write summary audit entry."""
        end = datetime.now()
        result.finished_at = end.isoformat()
        result.duration_seconds = (end - start).total_seconds()

        # Persist last-success timestamp for incremental pulls
        if result.status == "completed":
            self._save_state({
                "last_success": result.started_at,
                "last_result": result.to_dict(),
            })

        # Audit: job complete
        self.audit.log_event("job_complete", {
            "status": result.status,
            "ingested": result.tracks_ingested,
            "classified": result.tracks_classified,
            "routed": result.tracks_routed,
            "failed": result.tracks_failed,
            "errors": result.errors[:10],
            "duration_seconds": result.duration_seconds,
        })

        logger.info("ingest_job_done | %s", result.summary_line())

        self.source.close()
