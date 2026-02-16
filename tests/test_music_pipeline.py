"""
Tests for the OPX Music Ingestion Pipeline.

Tests each stage independently (metadata, classifier, router, audit)
and runs an integrated end-to-end pipeline test with a mock source server.
"""

import json
import os
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from unittest import mock

import pytest

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
from opx_music.config import MusicConfig, SourceConfig, WMXVConfig, ScheduleConfig


class TestMusicConfig:
    def test_defaults(self):
        config = MusicConfig()
        assert config.source.max_retries == 4
        assert config.wmxv.publish_root == "./wmxv_publish"
        assert config.schedule.cron_day == "sunday"
        assert config.audit_log_path == "./opx_audit.log"

    def test_validate_missing_url(self):
        config = MusicConfig()
        errors = config.validate()
        assert any("server_url" in e for e in errors)

    def test_validate_missing_auth(self):
        config = MusicConfig(source=SourceConfig(server_url="http://x"))
        errors = config.validate()
        assert any("api_key" in e or "username" in e for e in errors)

    def test_validate_ok(self):
        config = MusicConfig(
            source=SourceConfig(server_url="http://x", api_key="k"),
        )
        errors = config.validate()
        assert errors == []

    def test_from_env(self):
        env = {
            "OPX_SOURCE_URL": "http://test",
            "OPX_SOURCE_API_KEY": "abc",
            "WMXV_PUBLISH_ROOT": "/tmp/wmxv",
        }
        with mock.patch.dict(os.environ, env):
            config = MusicConfig.from_env()
            assert config.source.server_url == "http://test"
            assert config.source.api_key == "abc"
            assert config.wmxv.publish_root == "/tmp/wmxv"


# ---------------------------------------------------------------------------
# Metadata
# ---------------------------------------------------------------------------
from opx_music.metadata import extract_metadata, TrackMeta, _normalize_title


class TestMetadata:
    @pytest.fixture()
    def tmp_audio(self, tmp_path):
        """Create a dummy audio file."""
        p = tmp_path / "test_track.mp3"
        p.write_bytes(b"\xff\xfb\x90\x00" + b"\x00" * 256)  # fake MP3 header
        return p

    def test_extract_from_server_meta(self, tmp_audio):
        server = {
            "id": "42",
            "title": "My Song (Clean)",
            "artist": "  Test Artist  ",
            "genre": "Hip-Hop",
            "year": 2025,
            "duration": 210,
            "bpm": 128,
        }
        meta = extract_metadata(str(tmp_audio), server_meta=server)
        assert meta.track_id == "42"
        assert meta.title == "My Song"  # "(Clean)" stripped
        assert meta.artist == "Test Artist"  # whitespace trimmed
        assert meta.genre == "Hip-Hop"
        assert meta.year == 2025
        assert meta.bpm == 128
        assert meta.file_format == "mp3"
        assert meta.file_size > 0

    def test_extract_fallback_to_filename(self, tmp_audio):
        meta = extract_metadata(str(tmp_audio))
        assert meta.title == "test_track"  # stem of filename
        assert meta.track_id == "test_track"

    def test_file_not_found(self):
        with pytest.raises(Exception):
            extract_metadata("/nonexistent/track.mp3")

    def test_normalize_title(self):
        assert _normalize_title("Song (Clean)") == "Song"
        assert _normalize_title("Song [Radio Edit]") == "Song"
        assert _normalize_title("Song (Dirty)") == "Song"
        assert _normalize_title("Song [Explicit]") == "Song"
        assert _normalize_title("Normal Title") == "Normal Title"


# ---------------------------------------------------------------------------
# Classifier
# ---------------------------------------------------------------------------
from opx_music.classifier import classify_track, UNCLASSIFIED


class TestClassifier:
    def _meta(self, **kwargs):
        defaults = {
            "track_id": "1", "title": "Test", "artist": "Artist",
            "genre": "", "year": None, "duration_seconds": 200,
        }
        defaults.update(kwargs)
        return TrackMeta(**defaults)

    def test_rap_genre(self):
        assert classify_track(self._meta(genre="Hip-Hop")) == "Hot Rap"
        assert classify_track(self._meta(genre="rap")) == "Hot Rap"
        assert classify_track(self._meta(genre="Trap")) == "Hot Rap"

    def test_rnb_genre(self):
        assert classify_track(self._meta(genre="R&B")) == "Hot R&B"
        assert classify_track(self._meta(genre="Soul")) == "Hot R&B"

    def test_pop_genre(self):
        assert classify_track(self._meta(genre="Pop")) == "Hot Pop"

    def test_country_genre(self):
        assert classify_track(self._meta(genre="Country")) == "Hot Country"

    def test_rock_genre(self):
        assert classify_track(self._meta(genre="Rock")) == "Hot Rock"
        assert classify_track(self._meta(genre="Alternative")) == "Hot Rock"

    def test_latin_genre(self):
        assert classify_track(self._meta(genre="Reggaeton")) == "Hot Latin"

    def test_gospel_genre(self):
        assert classify_track(self._meta(genre="Gospel")) == "Hot Gospel"

    def test_dance_genre(self):
        assert classify_track(self._meta(genre="EDM")) == "Hot Dance"
        assert classify_track(self._meta(genre="House")) == "Hot Dance"

    def test_jazz_genre(self):
        assert classify_track(self._meta(genre="Jazz")) == "Hot Jazz"

    def test_classical_genre(self):
        assert classify_track(self._meta(genre="Classical")) == "Hot Classical"

    def test_keyword_fallback(self):
        # Genre empty but title contains keyword
        assert classify_track(self._meta(title="My Rap Song")) == "Hot Rap"

    def test_new_releases_by_year(self):
        current_year = datetime.now().year
        assert classify_track(self._meta(year=current_year)) == "New Releases"

    def test_unclassified(self):
        assert classify_track(self._meta(genre="Ambient Noise", year=1990)) == UNCLASSIFIED

    def test_empty_meta(self):
        assert classify_track(self._meta(title="", artist="")) == UNCLASSIFIED


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------
from opx_music.router import WMXVRouter


class TestRouter:
    @pytest.fixture()
    def router(self, tmp_path):
        config = WMXVConfig(publish_root=str(tmp_path / "wmxv"))
        return WMXVRouter(config)

    @pytest.fixture()
    def sample_file(self, tmp_path):
        f = tmp_path / "song.mp3"
        f.write_bytes(b"\x00" * 100)
        return f

    def test_ensure_folders(self, router):
        router.ensure_folders()
        root = Path(router.config.publish_root)
        assert (root / "hot_rap").is_dir()
        assert (root / "hot_rnb").is_dir()
        assert (root / "new_releases").is_dir()

    def test_route_track(self, router, sample_file):
        dest = router.route_track(str(sample_file), "Hot Rap")
        assert Path(dest).exists()
        assert "hot_rap" in dest
        assert Path(dest).stat().st_size == 100

    def test_route_unknown_classification(self, router, sample_file):
        dest = router.route_track(str(sample_file), "Unknown Genre")
        assert "unclassified" in dest

    def test_route_missing_source(self, router):
        with pytest.raises(Exception):
            router.route_track("/does/not/exist.mp3", "Hot Rap")

    def test_list_published(self, router, sample_file):
        router.route_track(str(sample_file), "Hot Rap")
        published = router.list_published("Hot Rap")
        assert "song.mp3" in published.get("Hot Rap", [])


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------
from opx_music.audit import AuditLogger


class TestAudit:
    @pytest.fixture()
    def audit(self, tmp_path):
        return AuditLogger(str(tmp_path / "audit.log"))

    def test_log_publish(self, audit):
        audit.log_publish("1", "Song", "Artist", "Hot Rap", "/dest/song.mp3")
        entries = audit.read_log()
        assert len(entries) == 1
        assert entries[0]["event"] == "track_published"
        assert entries[0]["classification"] == "Hot Rap"

    def test_log_event(self, audit):
        audit.log_event("job_start", {"since": None})
        audit.log_event("job_complete", {"status": "completed", "ingested": 1, "routed": 3})
        entries = audit.read_log()
        assert len(entries) == 2
        assert entries[1]["event"] == "job_complete"
        assert entries[1]["routed"] == 3

    def test_get_published_count(self, audit):
        audit.log_publish("1", "A", "X", "Hot Rap", "/a")
        audit.log_publish("2", "B", "Y", "Hot Pop", "/b")
        audit.log_publish("3", "C", "Z", "Hot Rap", "/c")
        assert audit.get_published_count() == 3
        assert audit.get_published_count("Hot Rap") == 2
        assert audit.get_published_count("Hot Pop") == 1

    def test_get_last_job_summary(self, audit):
        audit.log_event("job_complete", {"status": "completed", "ingested": 1, "routed": 3})
        summary = audit.get_last_job_summary()
        assert summary["status"] == "completed"
        assert summary["routed"] == 3

    def test_empty_log(self, audit):
        assert audit.read_log() == []
        assert audit.get_last_job_summary() is None


# ---------------------------------------------------------------------------
# Integrated Worker (mocked source server)
# ---------------------------------------------------------------------------
from opx_music.worker import IngestWorker, IngestResult


class TestIngestWorker:
    @pytest.fixture()
    def work_dir(self, tmp_path):
        """Set up a temporary working directory with all needed subdirs."""
        return tmp_path

    @pytest.fixture()
    def config(self, work_dir):
        return MusicConfig(
            source=SourceConfig(
                server_url="http://mock-music.test",
                api_key="test-key",
                download_dir=str(work_dir / "downloads"),
                max_retries=1,
            ),
            wmxv=WMXVConfig(publish_root=str(work_dir / "wmxv")),
            audit_log_path=str(work_dir / "audit.log"),
            state_path=str(work_dir / "state.json"),
        )

    def _fake_track(self, track_id, title, artist, genre, filename):
        return {
            "id": track_id,
            "title": title,
            "artist": artist,
            "genre": genre,
            "filename": filename,
            "duration": 210,
            "year": datetime.now().year,
        }

    def test_full_pipeline_mocked(self, config, work_dir):
        """End-to-end test with mocked HTTP calls."""
        # Pre-create a "downloaded" file
        dl_dir = Path(config.source.download_dir)
        dl_dir.mkdir(parents=True, exist_ok=True)

        track_file = dl_dir / "track1.mp3"
        track_file.write_bytes(b"\xff\xfb\x90\x00" + b"\x00" * 256)

        track_meta = self._fake_track("1", "Fire Flow", "MC Test", "Hip-Hop", "track1.mp3")

        worker = IngestWorker(config)

        # Mock source methods
        worker.source.test_connection = mock.Mock(return_value=True)
        worker.source.authenticate = mock.Mock(return_value=True)
        worker.source.list_tracks = mock.Mock(return_value=[track_meta])
        worker.source.download_tracks = mock.Mock(return_value=[
            {"track": track_meta, "path": str(track_file), "success": True, "error": None}
        ])
        worker.source.close = mock.Mock()

        result = worker.run()

        assert result.status == "completed"
        assert result.tracks_listed == 1
        assert result.tracks_downloaded == 1
        assert result.tracks_ingested == 1
        assert result.tracks_classified == 1
        assert result.tracks_routed == 1
        assert result.tracks_published == 1
        assert result.tracks_failed == 0
        assert len(result.errors) == 0

        # Verify routed file
        assert len(result.routed_details) == 1
        detail = result.routed_details[0]
        assert detail["classification"] == "Hot Rap"
        assert Path(detail["dest_path"]).exists()

        # Verify audit log
        audit = AuditLogger(config.audit_log_path)
        entries = audit.read_log()
        publish_entries = [e for e in entries if e["event"] == "track_published"]
        assert len(publish_entries) == 1
        assert publish_entries[0]["classification"] == "Hot Rap"

        job_entries = [e for e in entries if e["event"] == "job_complete"]
        assert len(job_entries) == 1
        assert job_entries[0]["status"] == "completed"
        assert job_entries[0]["routed"] == 1

        # Verify state persistence
        state_path = Path(config.state_path)
        assert state_path.exists()
        state = json.loads(state_path.read_text())
        assert state.get("last_success") is not None

    def test_pipeline_with_multiple_genres(self, config, work_dir):
        """Test routing multiple tracks to different WMXV folders."""
        dl_dir = Path(config.source.download_dir)
        dl_dir.mkdir(parents=True, exist_ok=True)

        tracks = [
            (self._fake_track("1", "Rap Track", "Rapper", "Hip-Hop", "rap.mp3"), "rap.mp3"),
            (self._fake_track("2", "Pop Hit", "Singer", "Pop", "pop.mp3"), "pop.mp3"),
            (self._fake_track("3", "Country Road", "Nashville", "Country", "country.mp3"), "country.mp3"),
        ]

        download_results = []
        for meta, fname in tracks:
            f = dl_dir / fname
            f.write_bytes(b"\xff\xfb\x90\x00" + b"\x00" * 128)
            download_results.append({
                "track": meta, "path": str(f), "success": True, "error": None,
            })

        worker = IngestWorker(config)
        worker.source.test_connection = mock.Mock(return_value=True)
        worker.source.authenticate = mock.Mock(return_value=True)
        worker.source.list_tracks = mock.Mock(return_value=[t[0] for t in tracks])
        worker.source.download_tracks = mock.Mock(return_value=download_results)
        worker.source.close = mock.Mock()

        result = worker.run()

        assert result.status == "completed"
        assert result.tracks_routed == 3
        assert result.tracks_failed == 0

        classifications = {d["classification"] for d in result.routed_details}
        assert "Hot Rap" in classifications
        assert "Hot Pop" in classifications
        assert "Hot Country" in classifications

        # Verify WMXV folder contents
        wmxv = Path(config.wmxv.publish_root)
        assert (wmxv / "hot_rap" / "rap.mp3").exists()
        assert (wmxv / "hot_pop" / "pop.mp3").exists()
        assert (wmxv / "hot_country" / "country.mp3").exists()

    def test_pipeline_download_failure(self, config, work_dir):
        """Test that download failures are handled gracefully."""
        track_meta = self._fake_track("1", "Song", "Artist", "Pop", "song.mp3")

        worker = IngestWorker(config)
        worker.source.test_connection = mock.Mock(return_value=True)
        worker.source.authenticate = mock.Mock(return_value=True)
        worker.source.list_tracks = mock.Mock(return_value=[track_meta])
        worker.source.download_tracks = mock.Mock(return_value=[
            {"track": track_meta, "path": None, "success": False, "error": "Connection reset"},
        ])
        worker.source.close = mock.Mock()

        result = worker.run()

        assert result.status == "completed"
        assert result.tracks_failed == 1
        assert result.tracks_routed == 0
        assert any("download" in e for e in result.errors)

    def test_pipeline_connection_failure(self, config, work_dir):
        """Test that source connection failures produce a failed result."""
        worker = IngestWorker(config)
        worker.source.test_connection = mock.Mock(return_value=False)
        worker.source.close = mock.Mock()

        result = worker.run()

        assert result.status == "failed"
        assert any("source_connection" in e for e in result.errors)

    def test_no_new_tracks(self, config, work_dir):
        """Test graceful handling when server returns no tracks."""
        worker = IngestWorker(config)
        worker.source.test_connection = mock.Mock(return_value=True)
        worker.source.authenticate = mock.Mock(return_value=True)
        worker.source.list_tracks = mock.Mock(return_value=[])
        worker.source.close = mock.Mock()

        result = worker.run()

        assert result.status == "completed"
        assert result.tracks_listed == 0
        assert result.tracks_routed == 0
        assert result.tracks_failed == 0
