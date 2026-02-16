"""
WMXV publish folder router.

Copies/moves ingested track files into the correct WMXV publish
subfolder based on their classification. Creates target directories
on demand and verifies that files land correctly.
"""

import shutil
import logging
from pathlib import Path
from typing import Dict, Optional

from .config import WMXVConfig
from .exceptions import RoutingError

logger = logging.getLogger(__name__)


class WMXVRouter:
    """Routes classified tracks into WMXV publish folders."""

    def __init__(self, config: WMXVConfig):
        self.config = config
        self._publish_root = Path(config.publish_root)
        self._genre_folders = config.genre_folders

    def _resolve_folder(self, classification: str) -> Path:
        """Map a classification string to a publish folder path."""
        subfolder = self._genre_folders.get(classification)
        if not subfolder:
            subfolder = self._genre_folders.get("Unclassified", "unclassified")
            logger.warning(
                "router_unknown_classification | classification=%r using_fallback=%s",
                classification, subfolder,
            )
        return self._publish_root / subfolder

    def ensure_folders(self):
        """Pre-create all configured publish folders."""
        for classification, subfolder in self._genre_folders.items():
            folder = self._publish_root / subfolder
            folder.mkdir(parents=True, exist_ok=True)
        logger.info(
            "router_folders_ready | root=%s count=%d",
            self._publish_root, len(self._genre_folders),
        )

    def route_track(
        self,
        source_path: str,
        classification: str,
        filename: str = None,
    ) -> str:
        """
        Route a track file to the appropriate WMXV publish folder.

        Args:
            source_path: Current path to the track file.
            classification: Genre classification (e.g. "Hot Rap").
            filename: Override destination filename (default: keep original).

        Returns:
            Destination path as string.

        Raises:
            RoutingError: If the copy/move fails.
        """
        src = Path(source_path)
        if not src.exists():
            raise RoutingError(
                f"Source file not found: {source_path}",
                target_path=source_path,
            )

        dest_dir = self._resolve_folder(classification)
        dest_dir.mkdir(parents=True, exist_ok=True)

        dest_name = filename or src.name
        dest = dest_dir / dest_name

        try:
            shutil.copy2(str(src), str(dest))
        except OSError as exc:
            raise RoutingError(
                f"Failed to copy {src.name} -> {dest}: {exc}",
                target_path=str(dest),
            )

        if not dest.exists() or dest.stat().st_size == 0:
            raise RoutingError(
                f"Routed file missing or empty: {dest}",
                target_path=str(dest),
            )

        logger.info(
            "router_track_routed | classification=%s src=%s dest=%s size=%d",
            classification, src.name, dest, dest.stat().st_size,
        )
        return str(dest)

    def list_published(self, classification: str = None) -> Dict[str, list]:
        """List files currently in publish folders."""
        result: Dict[str, list] = {}
        folders = (
            {classification: self._genre_folders.get(classification, classification)}
            if classification
            else self._genre_folders
        )
        for cls_name, subfolder in folders.items():
            folder = self._publish_root / subfolder
            if folder.exists():
                files = sorted(f.name for f in folder.iterdir() if f.is_file())
                result[cls_name] = files
            else:
                result[cls_name] = []
        return result
