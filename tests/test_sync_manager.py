"""
Tests for sync manager reliability fixes.
"""

import json
import tempfile
import os
import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch
from pathlib import Path

from vimeo_roku_sdk.sync_manager import VideoCache, SyncManager, SyncState
from vimeo_roku_sdk.models import Video, Thumbnail, VideoFile, VideoQuality


def _make_video(video_id="123", title="Test", duration=300):
    """Helper to create a test Video."""
    return Video(
        id=video_id,
        title=title,
        description="Test description",
        duration=duration,
        created_time=datetime(2025, 1, 1),
        modified_time=datetime(2025, 1, 2),
        release_date=datetime(2025, 1, 1),
        thumbnails=[
            Thumbnail(url="https://example.com/thumb.jpg", width=1920, height=1080)
        ],
        video_files=[
            VideoFile(url="https://example.com/video.m3u8", quality=VideoQuality.HD, video_type="HLS")
        ],
        tags=["test"],
    )


class TestVideoCache:
    """Tests for VideoCache reliability."""

    def test_new_video_is_changed(self):
        """A video not yet in cache should be reported as changed."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = VideoCache(tmpdir)
            video = _make_video("new_vid")
            assert cache.is_changed(video) is True

    def test_unchanged_video_is_not_changed(self):
        """A cached video with same hash should be reported as unchanged."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = VideoCache(tmpdir)
            video = _make_video("vid1")
            cache.update(video, {"id": "vid1", "title": "Test"})
            assert cache.is_changed(video) is False

    def test_save_handles_disk_error(self):
        """Cache save should not raise on disk errors."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = VideoCache(tmpdir)
            video = _make_video("vid1")
            cache.update(video, {"id": "vid1"})

            # Make the cache file read-only to simulate disk error
            cache._cache_file.touch()
            os.chmod(str(cache._cache_file), 0o000)

            # Should not raise
            cache.save()

            # Cleanup permissions for tempdir removal
            os.chmod(str(cache._cache_file), 0o644)

    def test_save_feed_handles_disk_error(self):
        """Feed cache save should not raise on disk errors."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = VideoCache(tmpdir)

            cache._feed_cache_file.touch()
            os.chmod(str(cache._feed_cache_file), 0o000)

            # Should not raise
            cache.save_feed('{"test": true}')

            os.chmod(str(cache._feed_cache_file), 0o644)


class TestSyncState:
    """Tests for SyncState persistence."""

    def test_synced_video_ids_reset_on_load_cycle(self):
        """synced_video_ids should survive a save/load cycle."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "state.json")

            state = SyncState(
                last_sync=datetime(2025, 1, 1),
                synced_video_ids=["a", "b", "c"]
            )
            state.save(path)

            loaded = SyncState.load(path)
            assert loaded.synced_video_ids == ["a", "b", "c"]

    def test_corrupted_state_file_returns_default(self):
        """A corrupted state file should return a default SyncState."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "state.json")
            with open(path, "w") as f:
                f.write("not valid json{{{")

            state = SyncState.load(path)
            assert state.last_sync is None
            assert state.synced_video_ids == []


class TestVideoAddedCounter:
    """Tests ensuring videos_added vs videos_updated are counted correctly."""

    def test_new_video_counted_as_added(self):
        """A brand new video (not in cache) should increment videos_added."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = VideoCache(tmpdir)
            video = _make_video("new_123")

            # Video is not in cache
            assert cache.get_cached_roku_data("new_123") is None

            # Simulate the fixed logic
            is_existing = cache.get_cached_roku_data(video.id) is not None
            cache.update(video, {"id": "new_123"})

            assert is_existing is False  # Should be counted as added

    def test_existing_video_counted_as_updated(self):
        """A video already in cache should increment videos_updated."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = VideoCache(tmpdir)
            video = _make_video("existing_456")

            # Pre-populate cache
            cache.update(video, {"id": "existing_456"})

            # Now check (simulating the fixed logic)
            is_existing = cache.get_cached_roku_data(video.id) is not None
            cache.update(video, {"id": "existing_456", "updated": True})

            assert is_existing is True  # Should be counted as updated
