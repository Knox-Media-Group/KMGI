"""
Music source server client.

Connects to the OPX music server, lists available tracks, and downloads
them to a local staging directory. Includes retry logic with exponential
backoff for network resilience.
"""

import time
import logging
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin

import requests

from .config import SourceConfig
from .exceptions import SourceConnectionError, SourceAuthError, DownloadError

logger = logging.getLogger(__name__)

# Audio file extensions we accept
AUDIO_EXTENSIONS = {".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg", ".wma"}


class MusicSourceClient:
    """
    Client for connecting to the OPX music source server.

    Handles authentication, listing available tracks, and downloading
    audio files with retry logic and integrity verification.
    """

    def __init__(self, config: SourceConfig):
        self.config = config
        self._session: Optional[requests.Session] = None
        self._download_dir = Path(config.download_dir)

    @property
    def session(self) -> requests.Session:
        if self._session is None:
            self._session = self._create_session()
        return self._session

    def _create_session(self) -> requests.Session:
        s = requests.Session()
        if self.config.api_key:
            s.headers["Authorization"] = f"Bearer {self.config.api_key}"
            s.headers["X-API-Key"] = self.config.api_key
        s.headers["Accept"] = "application/json"
        s.verify = self.config.verify_ssl
        return s

    def _request_with_retry(
        self,
        method: str,
        url: str,
        **kwargs,
    ) -> requests.Response:
        """Make an HTTP request with exponential-backoff retries."""
        max_retries = self.config.max_retries
        timeout = kwargs.pop("timeout", self.config.timeout)

        last_exc = None
        for attempt in range(max_retries):
            try:
                response = self.session.request(
                    method, url, timeout=timeout, **kwargs
                )

                if response.status_code in (401, 403):
                    raise SourceAuthError(
                        f"Auth failed ({response.status_code}): {response.text[:200]}",
                        url=url,
                        status_code=response.status_code,
                    )

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    logger.warning(
                        "source_rate_limited | attempt=%d retry_after=%ds url=%s",
                        attempt + 1, retry_after, url,
                    )
                    if attempt < max_retries - 1:
                        time.sleep(retry_after)
                        continue
                    raise SourceConnectionError(
                        "Rate limit exceeded",
                        url=url,
                        status_code=429,
                    )

                if response.status_code >= 500:
                    logger.warning(
                        "source_server_error | attempt=%d status=%d url=%s",
                        attempt + 1, response.status_code, url,
                    )
                    if attempt < max_retries - 1:
                        wait = 2 ** attempt
                        time.sleep(wait)
                        continue
                    raise SourceConnectionError(
                        f"Server error {response.status_code}: {response.text[:200]}",
                        url=url,
                        status_code=response.status_code,
                    )

                if response.status_code >= 400:
                    raise SourceConnectionError(
                        f"Request failed ({response.status_code}): {response.text[:200]}",
                        url=url,
                        status_code=response.status_code,
                    )

                return response

            except requests.exceptions.RequestException as exc:
                last_exc = exc
                if attempt < max_retries - 1:
                    wait = 2 ** attempt
                    logger.warning(
                        "source_request_failed | attempt=%d wait=%ds error=%s url=%s",
                        attempt + 1, wait, exc, url,
                    )
                    time.sleep(wait)
                    continue

        raise SourceConnectionError(
            f"Request failed after {max_retries} attempts: {last_exc}",
            url=url,
        )

    # ------------------------------------------------------------------
    # Server connectivity
    # ------------------------------------------------------------------

    def test_connection(self) -> bool:
        """Test connectivity and auth against the music server."""
        url = urljoin(self.config.server_url, "/api/health")
        try:
            resp = self._request_with_retry("GET", url)
            logger.info("source_connection_ok | status=%d url=%s", resp.status_code, url)
            return True
        except (SourceConnectionError, SourceAuthError) as exc:
            logger.error("source_connection_failed | error=%s", exc)
            return False

    def authenticate(self) -> bool:
        """Authenticate with username/password if api_key is not set."""
        if self.config.api_key:
            return True  # Already using API key auth

        if not (self.config.username and self.config.password):
            raise SourceAuthError("No api_key or username/password configured")

        url = urljoin(self.config.server_url, "/api/auth/login")
        try:
            resp = self._request_with_retry(
                "POST",
                url,
                json={
                    "username": self.config.username,
                    "password": self.config.password,
                },
            )
            data = resp.json()
            token = data.get("token") or data.get("access_token")
            if not token:
                raise SourceAuthError("Auth response missing token")

            self.session.headers["Authorization"] = f"Bearer {token}"
            logger.info("source_authenticated | user=%s", self.config.username)
            return True
        except SourceConnectionError:
            raise
        except Exception as exc:
            raise SourceAuthError(f"Authentication failed: {exc}")

    # ------------------------------------------------------------------
    # Track listing
    # ------------------------------------------------------------------

    def list_tracks(self, since: str = None) -> List[Dict[str, Any]]:
        """
        List available tracks on the music server.

        Args:
            since: ISO datetime string; only return tracks added/modified after this.

        Returns:
            List of track metadata dicts from the server, each containing at
            minimum: id, title, artist, filename, download_url.
        """
        url = urljoin(self.config.server_url, "/api/tracks")
        params = {}
        if since:
            params["since"] = since

        resp = self._request_with_retry("GET", url, params=params)
        data = resp.json()

        tracks = data if isinstance(data, list) else data.get("tracks", data.get("data", []))
        logger.info("source_list_tracks | count=%d since=%s", len(tracks), since)
        return tracks

    # ------------------------------------------------------------------
    # Downloading
    # ------------------------------------------------------------------

    def _ensure_download_dir(self):
        self._download_dir.mkdir(parents=True, exist_ok=True)

    def download_track(self, track: Dict[str, Any]) -> Path:
        """
        Download a single track file to the local staging directory.

        Args:
            track: Track metadata dict (must include download_url or id).

        Returns:
            Path to the downloaded file.

        Raises:
            DownloadError: If the download fails after retries.
        """
        self._ensure_download_dir()

        track_id = str(track.get("id", "unknown"))
        download_url = track.get("download_url") or track.get("url")
        if not download_url:
            # Build URL from server base + track id
            download_url = urljoin(
                self.config.server_url,
                f"/api/tracks/{track_id}/download",
            )

        filename = track.get("filename") or f"{track_id}.mp3"
        dest = self._download_dir / filename

        logger.info(
            "source_download_start | track_id=%s filename=%s url=%s",
            track_id, filename, download_url,
        )

        try:
            resp = self._request_with_retry("GET", download_url, stream=True)

            with open(dest, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)

            file_size = dest.stat().st_size
            if file_size == 0:
                dest.unlink(missing_ok=True)
                raise DownloadError(
                    f"Downloaded file is empty: {filename}",
                    track_id=track_id,
                )

            logger.info(
                "source_download_complete | track_id=%s size=%d path=%s",
                track_id, file_size, dest,
            )
            return dest

        except (SourceConnectionError, SourceAuthError):
            raise
        except DownloadError:
            raise
        except Exception as exc:
            dest.unlink(missing_ok=True)
            raise DownloadError(
                f"Download failed for {track_id}: {exc}",
                track_id=track_id,
            )

    def download_tracks(self, tracks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Download multiple tracks. Returns list of dicts with download results.

        Each result dict: {track, path, success, error}
        """
        results = []
        for track in tracks:
            track_id = str(track.get("id", "unknown"))
            try:
                path = self.download_track(track)
                results.append({
                    "track": track,
                    "path": str(path),
                    "success": True,
                    "error": None,
                })
            except (DownloadError, SourceConnectionError) as exc:
                logger.error(
                    "source_download_failed | track_id=%s error=%s",
                    track_id, exc,
                )
                results.append({
                    "track": track,
                    "path": None,
                    "success": False,
                    "error": str(exc),
                })
        return results

    def close(self):
        if self._session:
            self._session.close()
            self._session = None
