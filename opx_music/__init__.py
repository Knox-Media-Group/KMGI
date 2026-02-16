"""
OPX Music Ingestion Pipeline

Downloads tracks from the music server, extracts/normalizes metadata,
classifies by genre, routes to WMXV publish folders, and maintains
publish audit logs. Runs on a weekly schedule.
"""

__version__ = "1.0.0"
__author__ = "Knox Media Group"

from .config import MusicConfig
from .worker import IngestWorker
from .pipeline import MusicPipeline
from .audit import AuditLogger

__all__ = [
    "MusicConfig",
    "IngestWorker",
    "MusicPipeline",
    "AuditLogger",
]
