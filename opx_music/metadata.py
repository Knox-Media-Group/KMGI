"""
Track metadata extraction and normalization.

Reads audio file tags (ID3 for MP3, Vorbis comments for FLAC/OGG, etc.)
and normalizes them into a standard TrackMeta dataclass. Falls back to
server-provided metadata when file tags are missing.
"""

import re
import logging
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional, Dict, Any, List

from .exceptions import MetadataError

logger = logging.getLogger(__name__)


@dataclass
class TrackMeta:
    """Normalized track metadata."""
    track_id: str = ""
    title: str = ""
    artist: str = ""
    album: str = ""
    genre: str = ""
    year: Optional[int] = None
    duration_seconds: float = 0.0
    bpm: Optional[int] = None
    bitrate: Optional[int] = None
    sample_rate: Optional[int] = None
    file_format: str = ""
    filename: str = ""
    file_size: int = 0
    # Additional tags from server
    label: str = ""
    isrc: str = ""
    mood: str = ""
    energy: str = ""
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _try_mutagen(filepath: Path) -> Dict[str, Any]:
    """Try to read tags using mutagen. Returns empty dict on failure."""
    try:
        import mutagen
        from mutagen.easyid3 import EasyID3
        from mutagen.mp3 import MP3
        from mutagen.flac import FLAC
        from mutagen.oggvorbis import OggVorbis
    except ImportError:
        logger.debug("mutagen not installed; skipping file-level tag extraction")
        return {}

    tags: Dict[str, Any] = {}
    try:
        audio = mutagen.File(str(filepath), easy=True)
        if audio is None:
            return tags

        for key in ("title", "artist", "album", "genre", "date", "bpm", "isrc"):
            val = audio.get(key)
            if val:
                tags[key] = val[0] if isinstance(val, list) else val

        # Duration / bitrate from info
        if hasattr(audio, "info"):
            info = audio.info
            if hasattr(info, "length"):
                tags["duration_seconds"] = float(info.length)
            if hasattr(info, "bitrate"):
                tags["bitrate"] = int(info.bitrate)
            if hasattr(info, "sample_rate"):
                tags["sample_rate"] = int(info.sample_rate)

    except Exception as exc:
        logger.warning("metadata_mutagen_failed | path=%s error=%s", filepath, exc)

    return tags


_TITLE_CLEAN_RE = re.compile(r"\s*[\(\[](clean|dirty|explicit|radio edit|album version)[\)\]]", re.IGNORECASE)
_FEAT_RE = re.compile(r"\s*(feat\.?|ft\.?|featuring)\s+", re.IGNORECASE)


def _normalize_title(raw: str) -> str:
    """Strip version markers and normalize whitespace."""
    title = _TITLE_CLEAN_RE.sub("", raw).strip()
    return " ".join(title.split())


def _normalize_artist(raw: str) -> str:
    """Normalize artist name: trim, collapse whitespace."""
    return " ".join(raw.strip().split())


def _parse_year(raw: Any) -> Optional[int]:
    if raw is None:
        return None
    try:
        return int(str(raw)[:4])
    except (ValueError, TypeError):
        return None


def extract_metadata(
    filepath: str,
    server_meta: Dict[str, Any] = None,
) -> TrackMeta:
    """
    Extract and normalize metadata for an audio file.

    Reads file-level tags via mutagen (if available), then layers on
    server-provided metadata as fallback. Returns a normalized TrackMeta.

    Args:
        filepath: Path to the audio file on disk.
        server_meta: Optional dict of metadata from the source server.

    Returns:
        TrackMeta with all fields populated to the extent possible.

    Raises:
        MetadataError: If the file cannot be read at all.
    """
    path = Path(filepath)
    if not path.exists():
        raise MetadataError(f"File not found: {filepath}", filepath=filepath)

    server_meta = server_meta or {}

    # Attempt file-level extraction
    file_tags = _try_mutagen(path)

    # Merge: file tags take precedence, server meta fills gaps
    track_id = str(server_meta.get("id", path.stem))
    raw_title = file_tags.get("title") or server_meta.get("title") or path.stem
    raw_artist = file_tags.get("artist") or server_meta.get("artist") or ""
    raw_genre = file_tags.get("genre") or server_meta.get("genre") or ""
    raw_album = file_tags.get("album") or server_meta.get("album") or ""
    raw_year = file_tags.get("date") or server_meta.get("year")
    raw_bpm = file_tags.get("bpm") or server_meta.get("bpm")
    raw_isrc = file_tags.get("isrc") or server_meta.get("isrc") or ""

    duration = (
        file_tags.get("duration_seconds")
        or server_meta.get("duration_seconds")
        or server_meta.get("duration")
        or 0.0
    )

    meta = TrackMeta(
        track_id=track_id,
        title=_normalize_title(raw_title),
        artist=_normalize_artist(raw_artist),
        album=raw_album.strip(),
        genre=raw_genre.strip(),
        year=_parse_year(raw_year),
        duration_seconds=float(duration),
        bpm=int(raw_bpm) if raw_bpm else None,
        bitrate=file_tags.get("bitrate") or server_meta.get("bitrate"),
        sample_rate=file_tags.get("sample_rate") or server_meta.get("sample_rate"),
        file_format=path.suffix.lstrip(".").lower(),
        filename=path.name,
        file_size=path.stat().st_size,
        label=server_meta.get("label", ""),
        isrc=raw_isrc.strip(),
        mood=server_meta.get("mood", ""),
        energy=server_meta.get("energy", ""),
        extra={k: v for k, v in server_meta.items() if k not in {
            "id", "title", "artist", "album", "genre", "year", "bpm",
            "duration", "duration_seconds", "bitrate", "sample_rate",
            "label", "isrc", "mood", "energy", "download_url", "url",
            "filename",
        }},
    )

    logger.info(
        "metadata_extracted | track_id=%s title=%r artist=%r genre=%r duration=%.1f bpm=%s",
        meta.track_id, meta.title, meta.artist, meta.genre,
        meta.duration_seconds, meta.bpm,
    )
    return meta
