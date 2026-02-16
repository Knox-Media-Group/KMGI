"""
Genre classification engine for WMXV routing.

Assigns each track to a WMXV publish category (e.g. "Hot Rap",
"Hot R&B", "New Releases") based on genre tags, mood, energy,
and keyword heuristics.
"""

import logging
from typing import Optional

from .metadata import TrackMeta

logger = logging.getLogger(__name__)

# Keyword -> classification mapping.  Order matters: first match wins.
# Each entry is (set-of-keywords, classification).
_GENRE_RULES = [
    ({"rap", "hip-hop", "hip hop", "hiphop", "trap", "drill"}, "Hot Rap"),
    ({"r&b", "rnb", "r and b", "rhythm and blues", "soul", "neo-soul"}, "Hot R&B"),
    ({"pop", "synth-pop", "synthpop", "electropop", "indie pop"}, "Hot Pop"),
    ({"country", "americana", "bluegrass", "honky-tonk"}, "Hot Country"),
    ({"rock", "alt-rock", "alternative", "punk", "grunge", "metal", "hard rock"}, "Hot Rock"),
    ({"latin", "reggaeton", "bachata", "salsa", "cumbia", "latin pop"}, "Hot Latin"),
    ({"gospel", "christian", "worship", "praise", "ccm"}, "Hot Gospel"),
    ({"dance", "edm", "electronic", "house", "techno", "trance", "dubstep", "drum and bass"}, "Hot Dance"),
    ({"jazz", "smooth jazz", "bebop", "swing", "fusion"}, "Hot Jazz"),
    ({"classical", "orchestra", "symphony", "chamber", "opera"}, "Hot Classical"),
]

DEFAULT_CLASSIFICATION = "New Releases"
UNCLASSIFIED = "Unclassified"


def classify_track(meta: TrackMeta) -> str:
    """
    Classify a track into a WMXV category.

    Strategy:
    1. Check the genre tag against known keyword sets.
    2. If no genre match, check title/artist for genre keywords.
    3. If still unmatched and the track has a year matching current year,
       categorize as "New Releases".
    4. Fallback to "Unclassified".

    Args:
        meta: Normalized track metadata.

    Returns:
        Classification string (e.g. "Hot Rap").
    """
    if not meta.title and not meta.artist:
        logger.warning(
            "classify_skip_empty | track_id=%s reason=no_title_or_artist",
            meta.track_id,
        )
        return UNCLASSIFIED

    # Combine searchable text
    genre_lower = meta.genre.lower()
    title_lower = meta.title.lower()
    artist_lower = meta.artist.lower()
    mood_lower = meta.mood.lower() if meta.mood else ""
    combined = f"{genre_lower} {title_lower} {artist_lower} {mood_lower}"

    # 1) Match against genre tag first (most reliable)
    if genre_lower:
        for keywords, classification in _GENRE_RULES:
            if genre_lower in keywords or any(kw in genre_lower for kw in keywords):
                logger.info(
                    "classify_match | track_id=%s classification=%s method=genre_tag genre=%s",
                    meta.track_id, classification, meta.genre,
                )
                return classification

    # 2) Broaden search to full combined text
    for keywords, classification in _GENRE_RULES:
        if any(kw in combined for kw in keywords):
            logger.info(
                "classify_match | track_id=%s classification=%s method=keyword_scan",
                meta.track_id, classification,
            )
            return classification

    # 3) Fallback to New Releases if recent
    from datetime import datetime
    current_year = datetime.now().year
    if meta.year and meta.year >= current_year - 1:
        logger.info(
            "classify_match | track_id=%s classification=%s method=recent_release year=%d",
            meta.track_id, DEFAULT_CLASSIFICATION, meta.year,
        )
        return DEFAULT_CLASSIFICATION

    # 4) Unclassified
    logger.info(
        "classify_unmatched | track_id=%s genre=%r title=%r",
        meta.track_id, meta.genre, meta.title,
    )
    return UNCLASSIFIED
