"""
Sync manager for orchestrating Vimeo to Roku content synchronization.

Optimized for speed with:
- Concurrent Vimeo API page fetching
- Local video metadata cache for fast daily syncs
- Incremental sync (only new/modified videos)
"""

import json
import hashlib
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass, field

from .vimeo_client import VimeoClient
from .roku_feed import RokuFeedGenerator, RokuFeedUploader
from .models import Video, RokuVideo, VideoType
from .config import Config, VimeoConfig, RokuConfig, SyncConfig
from .exceptions import SyncError, VimeoAPIError, RokuFeedError

logger = logging.getLogger(__name__)


@dataclass
class SyncResult:
    """Result of a sync operation."""
    success: bool
    videos_processed: int = 0
    videos_added: int = 0
    videos_updated: int = 0
    videos_unchanged: int = 0
    videos_skipped: int = 0
    videos_failed: int = 0
    feed_path: Optional[str] = None
    feed_url: Optional[str] = None
    errors: List[str] = field(default_factory=list)
    duration_seconds: float = 0
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "videos_processed": self.videos_processed,
            "videos_added": self.videos_added,
            "videos_updated": self.videos_updated,
            "videos_unchanged": self.videos_unchanged,
            "videos_skipped": self.videos_skipped,
            "videos_failed": self.videos_failed,
            "feed_path": self.feed_path,
            "feed_url": self.feed_url,
            "errors": self.errors,
            "duration_seconds": self.duration_seconds,
            "timestamp": self.timestamp.isoformat()
        }


class VideoCache:
    """
    Local cache for video metadata to enable fast incremental syncs.

    Stores a hash of each video's key fields. On subsequent syncs,
    only videos with changed hashes need reprocessing.
    """

    def __init__(self, cache_dir: str):
        self._cache_dir = Path(cache_dir)
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        self._cache_file = self._cache_dir / "video_cache.json"
        self._feed_cache_file = self._cache_dir / "cached_feed.json"
        self._data: Dict[str, Dict[str, Any]] = {}
        self._load()

    def _load(self):
        if self._cache_file.exists():
            try:
                with open(self._cache_file, "r") as f:
                    self._data = json.load(f)
            except (json.JSONDecodeError, IOError):
                self._data = {}

    def save(self):
        with open(self._cache_file, "w") as f:
            json.dump(self._data, f)

    @staticmethod
    def _video_hash(video: Video) -> str:
        """Create a hash of video fields that matter for the feed."""
        key = f"{video.id}|{video.title}|{video.description}|{video.duration}|{video.modified_time.isoformat()}"
        return hashlib.md5(key.encode()).hexdigest()

    def is_changed(self, video: Video) -> bool:
        """Check if a video has changed since last cache."""
        cached = self._data.get(video.id)
        if not cached:
            return True
        return cached.get("hash") != self._video_hash(video)

    def update(self, video: Video, roku_video_dict: Dict[str, Any]):
        """Update cache entry for a video."""
        self._data[video.id] = {
            "hash": self._video_hash(video),
            "roku_data": roku_video_dict,
            "video_type": "short_form" if video.duration < 900 else "movie",
            "cached_at": datetime.now().isoformat()
        }

    def get_cached_roku_data(self, video_id: str) -> Optional[Dict[str, Any]]:
        """Get cached Roku feed data for a video."""
        cached = self._data.get(video_id)
        if cached:
            return cached.get("roku_data")
        return None

    def get_cached_type(self, video_id: str) -> Optional[str]:
        """Get cached video type."""
        cached = self._data.get(video_id)
        if cached:
            return cached.get("video_type")
        return None

    def remove(self, video_id: str):
        """Remove a video from cache."""
        self._data.pop(video_id, None)

    def get_all_ids(self) -> set:
        """Get all cached video IDs."""
        return set(self._data.keys())

    def save_feed(self, feed_json: str):
        """Save a copy of the generated feed for fast rebuilds."""
        with open(self._feed_cache_file, "w") as f:
            f.write(feed_json)

    def get_cached_feed(self) -> Optional[str]:
        """Get the cached feed JSON."""
        if self._feed_cache_file.exists():
            with open(self._feed_cache_file, "r") as f:
                return f.read()
        return None

    def clear(self):
        self._data = {}
        if self._cache_file.exists():
            self._cache_file.unlink()
        if self._feed_cache_file.exists():
            self._feed_cache_file.unlink()


@dataclass
class SyncState:
    """Persistent state for incremental syncs."""
    last_sync: Optional[datetime] = None
    last_video_count: int = 0
    synced_video_ids: List[str] = field(default_factory=list)

    @classmethod
    def load(cls, filepath: str) -> "SyncState":
        path = Path(filepath)
        if not path.exists():
            return cls()
        try:
            with open(path, "r") as f:
                data = json.load(f)
            return cls(
                last_sync=datetime.fromisoformat(data["last_sync"]) if data.get("last_sync") else None,
                last_video_count=data.get("last_video_count", 0),
                synced_video_ids=data.get("synced_video_ids", [])
            )
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(f"Failed to load sync state: {e}")
            return cls()

    def save(self, filepath: str):
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "last_sync": self.last_sync.isoformat() if self.last_sync else None,
            "last_video_count": self.last_video_count,
            "synced_video_ids": self.synced_video_ids
        }
        with open(path, "w") as f:
            json.dump(data, f, indent=2)


class SyncManager:
    """
    Manages synchronization of videos from Vimeo to Roku.

    Optimized with:
    - Concurrent API fetching (6x faster page loading)
    - Local video cache (skip unchanged videos)
    - Incremental sync (only fetch new/modified)
    """

    def __init__(
        self,
        config: Config = None,
        vimeo_client: VimeoClient = None,
        feed_generator: RokuFeedGenerator = None
    ):
        self.config = config or Config()

        self.vimeo = vimeo_client or VimeoClient(config=self.config.vimeo)
        self.feed_generator = feed_generator or RokuFeedGenerator(config=self.config.roku)
        self.uploader = RokuFeedUploader(config=self.config.roku)

        self._state_path = Path(self.config.sync.cache_path) / "sync_state.json"
        self._state: Optional[SyncState] = None

        # Video cache for fast daily syncs
        self._cache = VideoCache(self.config.sync.cache_path) if self.config.sync.cache_enabled else None

        self._on_video_processed: Optional[Callable[[Video, bool], None]] = None
        self._on_progress: Optional[Callable[[int, int], None]] = None

    def set_callbacks(
        self,
        on_video_processed: Callable[[Video, bool], None] = None,
        on_progress: Callable[[int, int], None] = None
    ):
        self._on_video_processed = on_video_processed
        self._on_progress = on_progress

    def _load_state(self) -> SyncState:
        if self._state is None:
            if self.config.sync.cache_enabled:
                self._state = SyncState.load(str(self._state_path))
            else:
                self._state = SyncState()
        return self._state

    def _save_state(self):
        if self._state and self.config.sync.cache_enabled:
            self._state.save(str(self._state_path))

    def _should_include_video(self, video: Video) -> bool:
        if not self.config.sync.include_private and video.privacy != "anybody":
            return False
        if video.duration < self.config.sync.min_duration:
            return False
        if self.config.sync.max_duration and video.duration > self.config.sync.max_duration:
            return False
        if self.config.sync.include_tags:
            video_tags = [t.lower() for t in video.tags]
            include_tags = [t.lower() for t in self.config.sync.include_tags]
            if not any(tag in video_tags for tag in include_tags):
                return False
        if self.config.sync.exclude_tags:
            video_tags = [t.lower() for t in video.tags]
            exclude_tags = [t.lower() for t in self.config.sync.exclude_tags]
            if any(tag in video_tags for tag in exclude_tags):
                return False
        if not video.get_best_video_file():
            return False
        return True

    def _determine_video_type(self, video: Video) -> VideoType:
        if video.duration < self.config.sync.short_form_max_duration:
            return VideoType.SHORT_FORM
        return VideoType.MOVIE

    def fetch_videos(
        self,
        source: str = "all",
        album_id: str = None,
        folder_id: str = None,
        limit: int = None
    ) -> List[Video]:
        logger.info(f"Fetching videos from Vimeo (source: {source})...")

        def page_progress(done, total):
            logger.info(f"  Fetched page {done}/{total}")

        if source == "album":
            album_id = album_id or self.config.vimeo.album_id
            videos = self.vimeo.get_all_album_videos_fast(album_id=album_id)
        elif source == "folder":
            videos = []
            folder_id = folder_id or self.config.vimeo.folder_id
            for video in self.vimeo.iter_folder_videos(folder_id=folder_id):
                videos.append(video)
                if limit and len(videos) >= limit:
                    break
        else:
            videos = self.vimeo.get_all_videos_fast(limit=limit, on_progress=page_progress)

        logger.info(f"Fetched {len(videos)} videos from Vimeo")
        return videos

    def sync(
        self,
        source: str = "all",
        album_id: str = None,
        folder_id: str = None,
        incremental: bool = False,
        upload: bool = False,
        notify: bool = False
    ) -> SyncResult:
        """
        Perform a sync from Vimeo to Roku.

        With caching enabled, only changed videos are reprocessed.
        Unchanged videos use cached Roku feed data directly.
        """
        start_time = datetime.now()
        result = SyncResult(success=False)

        try:
            state = self._load_state()
            self.feed_generator.reset()

            # Fetch videos (concurrent)
            if incremental and state.last_sync:
                logger.info(f"Incremental sync since {state.last_sync}")
                videos = self.vimeo.get_videos_modified_since(state.last_sync)
            else:
                videos = self.fetch_videos(source, album_id, folder_id)

            total_videos = len(videos)
            logger.info(f"Processing {total_videos} videos...")

            current_ids = set()

            for idx, video in enumerate(videos):
                result.videos_processed += 1

                if self._on_progress:
                    self._on_progress(idx + 1, total_videos)

                try:
                    if not self._should_include_video(video):
                        result.videos_skipped += 1
                        continue

                    current_ids.add(video.id)

                    # Check cache - skip unchanged videos
                    if self._cache and not self._cache.is_changed(video):
                        cached_data = self._cache.get_cached_roku_data(video.id)
                        cached_type = self._cache.get_cached_type(video.id)
                        if cached_data:
                            cached_video = RokuVideo(
                                id=cached_data.get("id", ""),
                                title=cached_data.get("title", ""),
                                short_description=cached_data.get("shortDescription", ""),
                                long_description=cached_data.get("longDescription", ""),
                                release_date=cached_data.get("releaseDate", ""),
                                duration=cached_data.get("content", {}).get("duration", 0),
                                thumbnail=cached_data.get("thumbnail", ""),
                                content=cached_data.get("content", {}),
                                tags=cached_data.get("tags", []),
                                genres=cached_data.get("genres", []),
                                video_type=VideoType.SHORT_FORM if cached_type == "short_form" else VideoType.MOVIE
                            )
                            self.feed_generator.feed.add_video(cached_video)
                            result.videos_unchanged += 1
                            continue

                    # Process changed/new video
                    video_type = self._determine_video_type(video)
                    roku_video = RokuVideo.from_video(video, video_type)
                    self.feed_generator.add_video(video, video_type)

                    # Update cache
                    if self._cache:
                        self._cache.update(video, roku_video.to_dict())

                    if self._cache and self._cache.get_cached_roku_data(video.id):
                        result.videos_updated += 1
                    else:
                        result.videos_added += 1

                    state.synced_video_ids.append(video.id)

                    if self._on_video_processed:
                        self._on_video_processed(video, True)

                except Exception as e:
                    logger.error(f"Failed to process video {video.id}: {e}")
                    result.videos_failed += 1
                    result.errors.append(f"Video {video.id}: {str(e)}")

            # Validate and save feed
            validation_errors = self.feed_generator.validate()
            if validation_errors:
                for error in validation_errors:
                    result.errors.append(f"Validation: {error}")

            feed_path = self.feed_generator.save()
            result.feed_path = feed_path

            # Save cache
            if self._cache:
                self._cache.save()
                self._cache.save_feed(self.feed_generator.feed.to_json())

            # Upload to S3 if requested
            if upload and self.config.roku.s3_bucket:
                try:
                    result.feed_url = self.uploader.upload_to_s3(feed_path)
                except Exception as e:
                    logger.error(f"Failed to upload to S3: {e}")
                    result.errors.append(f"S3 upload: {str(e)}")

            if notify and result.feed_url:
                self.uploader.notify_webhook(result.feed_url)

            state.last_sync = datetime.now()
            state.last_video_count = result.videos_added + result.videos_unchanged + result.videos_updated
            self._save_state()

            result.success = True
            logger.info(
                f"Sync completed: {result.videos_added} new, "
                f"{result.videos_updated} updated, "
                f"{result.videos_unchanged} unchanged, "
                f"{result.videos_skipped} skipped, "
                f"{result.videos_failed} failed"
            )

        except VimeoAPIError as e:
            logger.error(f"Vimeo API error during sync: {e}")
            result.errors.append(f"Vimeo API: {str(e)}")

        except RokuFeedError as e:
            logger.error(f"Roku feed error during sync: {e}")
            result.errors.append(f"Roku feed: {str(e)}")

        except Exception as e:
            logger.error(f"Unexpected error during sync: {e}")
            result.errors.append(f"Unexpected: {str(e)}")

        finally:
            result.duration_seconds = (datetime.now() - start_time).total_seconds()

        return result

    def sync_album(self, album_id: str = None, **kwargs) -> SyncResult:
        return self.sync(source="album", album_id=album_id, **kwargs)

    def sync_folder(self, folder_id: str = None, **kwargs) -> SyncResult:
        return self.sync(source="folder", folder_id=folder_id, **kwargs)

    def get_feed_stats(self) -> Dict[str, Any]:
        return self.feed_generator.get_stats()

    def get_last_sync_info(self) -> Optional[Dict[str, Any]]:
        state = self._load_state()
        if not state.last_sync:
            return None
        return {
            "last_sync": state.last_sync.isoformat(),
            "video_count": state.last_video_count,
            "synced_ids_count": len(state.synced_video_ids)
        }

    def clear_cache(self):
        self._state = SyncState()
        if self._state_path.exists():
            self._state_path.unlink()
        if self._cache:
            self._cache.clear()
        logger.info("Sync cache cleared")


def create_sync_manager(
    vimeo_access_token: str,
    roku_provider_name: str,
    feed_output_path: str = "./roku_feed.json",
    **kwargs
) -> SyncManager:
    config = Config(
        vimeo=VimeoConfig(access_token=vimeo_access_token),
        roku=RokuConfig(
            provider_name=roku_provider_name,
            feed_output_path=feed_output_path
        ),
        sync=SyncConfig(**kwargs)
    )
    return SyncManager(config=config)
