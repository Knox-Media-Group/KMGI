"""
Vimeo API client for fetching video content.
"""

import time
import logging
from typing import Optional, List, Dict, Any, Generator
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

from .models import Video
from .config import VimeoConfig
from .exceptions import (
    VimeoAPIError,
    VimeoAuthError,
    VimeoRateLimitError
)

logger = logging.getLogger(__name__)

# Minimal fields for fast fetching (skip heavy fields like embed)
FAST_FIELDS = (
    "uri,name,description,duration,created_time,modified_time,"
    "release_time,pictures.sizes,files,play,tags.name,"
    "categories.name,privacy.view,link,stats.plays,"
    "metadata.connections.likes.total,player_embed_url"
)


class VimeoClient:
    """
    Client for interacting with the Vimeo API.

    Handles authentication, pagination, rate limiting, and video retrieval.
    Supports concurrent page fetching for large libraries.
    """

    BASE_URL = "https://api.vimeo.com"
    DEFAULT_PER_PAGE = 100  # Vimeo's max per page
    MAX_WORKERS = 6  # Concurrent API requests

    def __init__(
        self,
        access_token: str = None,
        client_id: str = None,
        client_secret: str = None,
        config: VimeoConfig = None,
        max_workers: int = None
    ):
        if config:
            self.access_token = config.access_token
            self.client_id = config.client_id
            self.client_secret = config.client_secret
            self._user_id = config.user_id
            self._folder_id = config.folder_id
            self._album_id = config.album_id
        else:
            self.access_token = access_token
            self.client_id = client_id
            self.client_secret = client_secret
            self._user_id = None
            self._folder_id = None
            self._album_id = None

        if not self.access_token:
            raise VimeoAuthError("Access token is required")

        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/vnd.vimeo.*+json;version=3.4"
        })

        self._max_workers = max_workers or self.MAX_WORKERS

    def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Dict[str, Any] = None,
        data: Dict[str, Any] = None,
        retry_count: int = 3
    ) -> Dict[str, Any]:
        """Make a request to the Vimeo API with retry logic."""
        url = f"{self.BASE_URL}{endpoint}"

        for attempt in range(retry_count):
            try:
                response = self.session.request(
                    method=method,
                    url=url,
                    params=params,
                    json=data,
                    timeout=30
                )

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    if attempt < retry_count - 1:
                        logger.warning(f"Rate limited, waiting {retry_after}s...")
                        time.sleep(retry_after)
                        continue
                    raise VimeoRateLimitError(
                        "Rate limit exceeded",
                        retry_after=retry_after
                    )

                if response.status_code in (401, 403):
                    raise VimeoAuthError(
                        f"Authentication failed: {response.text}",
                        status_code=response.status_code
                    )

                if response.status_code >= 400:
                    raise VimeoAPIError(
                        f"API request failed: {response.text}",
                        status_code=response.status_code,
                        response=response.json() if response.text else None
                    )

                return response.json() if response.text else {}

            except requests.exceptions.RequestException as e:
                if attempt < retry_count - 1:
                    wait_time = 2 ** attempt
                    logger.warning(f"Request failed, retrying in {wait_time}s: {e}")
                    time.sleep(wait_time)
                    continue
                raise VimeoAPIError(f"Request failed after {retry_count} attempts: {e}")

    def _get_endpoint(self, user_id: str = None, suffix: str = "") -> str:
        """Build the correct API endpoint for user resources."""
        if user_id:
            return f"/users/{user_id}{suffix}"
        elif self._user_id:
            return f"/users/{self._user_id}{suffix}"
        else:
            return f"/me{suffix}"

    def get_user(self, user_id: str = None) -> Dict[str, Any]:
        """Get user information."""
        return self._make_request("GET", self._get_endpoint(user_id))

    def get_video(self, video_id: str) -> Video:
        """Get a single video by ID."""
        params = {"fields": FAST_FIELDS}
        data = self._make_request("GET", f"/videos/{video_id}", params=params)
        return Video.from_vimeo_response(data)

    def _fetch_page(
        self,
        endpoint: str,
        page: int,
        per_page: int = 100,
        sort: str = "date",
        direction: str = "desc",
        filter_playable: bool = True,
        extra_params: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Fetch a single page of results."""
        params = {
            "per_page": per_page,
            "page": page,
            "sort": sort,
            "direction": direction,
            "fields": FAST_FIELDS
        }
        if filter_playable:
            params["filter"] = "playable"
        if extra_params:
            params.update(extra_params)

        return self._make_request("GET", endpoint, params=params)

    def get_videos(
        self,
        user_id: str = None,
        per_page: int = None,
        page: int = 1,
        sort: str = "date",
        direction: str = "desc",
        filter_playable: bool = True
    ) -> Dict[str, Any]:
        """Get videos for a user (single page)."""
        per_page = min(per_page or self.DEFAULT_PER_PAGE, 100)
        endpoint = self._get_endpoint(user_id, "/videos")
        return self._fetch_page(endpoint, page, per_page, sort, direction, filter_playable)

    def get_all_videos_fast(
        self,
        user_id: str = None,
        sort: str = "date",
        direction: str = "desc",
        filter_playable: bool = True,
        limit: int = None,
        on_progress: callable = None
    ) -> List[Video]:
        """
        Fetch all videos using concurrent page requests.

        Fetches page 1 first to determine total pages, then fetches
        all remaining pages in parallel using a thread pool.

        Args:
            user_id: User ID
            sort: Sort field
            direction: Sort direction
            filter_playable: Only return playable videos
            limit: Maximum number of videos to return
            on_progress: Callback(pages_done, total_pages)

        Returns:
            List of Video objects
        """
        endpoint = self._get_endpoint(user_id, "/videos")

        # Fetch first page to get total count
        logger.info("Fetching page 1 to determine total videos...")
        first_page = self._fetch_page(
            endpoint, 1, 100, sort, direction, filter_playable
        )

        total = first_page.get("total", 0)
        per_page = 100
        total_pages = (total + per_page - 1) // per_page

        if limit:
            max_pages = (limit + per_page - 1) // per_page
            total_pages = min(total_pages, max_pages)

        logger.info(f"Total videos: {total}, pages: {total_pages}")

        # Parse first page results
        all_video_data = {1: first_page.get("data", [])}

        if on_progress:
            on_progress(1, total_pages)

        if total_pages <= 1:
            return [Video.from_vimeo_response(v) for v in all_video_data.get(1, [])]

        # Fetch remaining pages concurrently
        remaining_pages = list(range(2, total_pages + 1))

        with ThreadPoolExecutor(max_workers=self._max_workers) as executor:
            future_to_page = {
                executor.submit(
                    self._fetch_page,
                    endpoint, page, per_page, sort, direction, filter_playable
                ): page
                for page in remaining_pages
            }

            completed = 1  # Page 1 already done
            for future in as_completed(future_to_page):
                page_num = future_to_page[future]
                completed += 1

                try:
                    result = future.result()
                    all_video_data[page_num] = result.get("data", [])
                    if on_progress:
                        on_progress(completed, total_pages)
                except Exception as e:
                    logger.error(f"Failed to fetch page {page_num}: {e}")
                    all_video_data[page_num] = []

        # Combine results in page order
        videos = []
        for page_num in sorted(all_video_data.keys()):
            for video_data in all_video_data[page_num]:
                videos.append(Video.from_vimeo_response(video_data))
                if limit and len(videos) >= limit:
                    return videos

        return videos

    def iter_all_videos(
        self,
        user_id: str = None,
        sort: str = "date",
        direction: str = "desc",
        filter_playable: bool = True
    ) -> Generator[Video, None, None]:
        """Iterate over all videos with automatic pagination (sequential)."""
        page = 1
        endpoint = self._get_endpoint(user_id, "/videos")
        while True:
            response = self._fetch_page(endpoint, page, 100, sort, direction, filter_playable)

            videos = response.get("data", [])
            if not videos:
                break

            for video_data in videos:
                yield Video.from_vimeo_response(video_data)

            paging = response.get("paging", {})
            if not paging.get("next"):
                break

            page += 1
            logger.debug(f"Fetching page {page}...")

    def get_all_videos(
        self,
        user_id: str = None,
        sort: str = "date",
        direction: str = "desc",
        filter_playable: bool = True,
        limit: int = None
    ) -> List[Video]:
        """Get all videos (uses fast concurrent fetching)."""
        return self.get_all_videos_fast(
            user_id=user_id,
            sort=sort,
            direction=direction,
            filter_playable=filter_playable,
            limit=limit
        )

    def get_album_videos(
        self,
        album_id: str = None,
        user_id: str = None,
        per_page: int = None,
        page: int = 1
    ) -> Dict[str, Any]:
        """Get videos from an album/showcase."""
        album_id = album_id or self._album_id
        if not album_id:
            raise VimeoAPIError("Album ID is required")

        endpoint = self._get_endpoint(user_id, f"/albums/{album_id}/videos")
        per_page = min(per_page or self.DEFAULT_PER_PAGE, 100)
        return self._fetch_page(endpoint, page, per_page)

    def get_all_album_videos_fast(
        self,
        album_id: str = None,
        user_id: str = None
    ) -> List[Video]:
        """Fetch all album videos using concurrent requests."""
        album_id = album_id or self._album_id
        if not album_id:
            raise VimeoAPIError("Album ID is required")

        endpoint = self._get_endpoint(user_id, f"/albums/{album_id}/videos")

        first_page = self._fetch_page(endpoint, 1, 100)
        total = first_page.get("total", 0)
        total_pages = (total + 99) // 100

        all_video_data = {1: first_page.get("data", [])}

        if total_pages > 1:
            remaining = list(range(2, total_pages + 1))
            with ThreadPoolExecutor(max_workers=self._max_workers) as executor:
                future_to_page = {
                    executor.submit(self._fetch_page, endpoint, p, 100): p
                    for p in remaining
                }
                for future in as_completed(future_to_page):
                    page_num = future_to_page[future]
                    try:
                        result = future.result()
                        all_video_data[page_num] = result.get("data", [])
                    except Exception as e:
                        logger.error(f"Failed to fetch album page {page_num}: {e}")

        videos = []
        for page_num in sorted(all_video_data.keys()):
            for vd in all_video_data[page_num]:
                videos.append(Video.from_vimeo_response(vd))
        return videos

    def iter_album_videos(
        self,
        album_id: str = None,
        user_id: str = None
    ) -> Generator[Video, None, None]:
        """Iterate over all videos in an album (sequential)."""
        album_id = album_id or self._album_id
        if not album_id:
            raise VimeoAPIError("Album ID is required")

        endpoint = self._get_endpoint(user_id, f"/albums/{album_id}/videos")
        page = 1
        while True:
            response = self._fetch_page(endpoint, page, 100)
            videos = response.get("data", [])
            if not videos:
                break
            for video_data in videos:
                yield Video.from_vimeo_response(video_data)
            paging = response.get("paging", {})
            if not paging.get("next"):
                break
            page += 1

    def get_folder_videos(
        self,
        folder_id: str = None,
        user_id: str = None,
        per_page: int = None,
        page: int = 1
    ) -> Dict[str, Any]:
        """Get videos from a folder/project."""
        folder_id = folder_id or self._folder_id
        if not folder_id:
            raise VimeoAPIError("Folder ID is required")

        endpoint = self._get_endpoint(user_id, f"/projects/{folder_id}/videos")
        per_page = min(per_page or self.DEFAULT_PER_PAGE, 100)
        return self._fetch_page(endpoint, page, per_page)

    def iter_folder_videos(
        self,
        folder_id: str = None,
        user_id: str = None
    ) -> Generator[Video, None, None]:
        """Iterate over all videos in a folder (sequential)."""
        folder_id = folder_id or self._folder_id
        if not folder_id:
            raise VimeoAPIError("Folder ID is required")

        endpoint = self._get_endpoint(user_id, f"/projects/{folder_id}/videos")
        page = 1
        while True:
            response = self._fetch_page(endpoint, page, 100)
            videos = response.get("data", [])
            if not videos:
                break
            for video_data in videos:
                yield Video.from_vimeo_response(video_data)
            paging = response.get("paging", {})
            if not paging.get("next"):
                break
            page += 1

    def get_videos_modified_since(
        self,
        since: datetime,
        user_id: str = None
    ) -> List[Video]:
        """Get videos modified since a specific date (for incremental sync)."""
        videos = []
        for video in self.iter_all_videos(user_id=user_id, sort="date", direction="desc"):
            if video.modified_time < since:
                break
            videos.append(video)
        return videos

    def search_videos(
        self,
        query: str,
        user_id: str = None,
        per_page: int = None,
        page: int = 1
    ) -> Dict[str, Any]:
        """Search videos by query."""
        per_page = min(per_page or self.DEFAULT_PER_PAGE, 100)
        endpoint = self._get_endpoint(user_id, "/videos") if (user_id or self._user_id) else "/videos"
        return self._fetch_page(
            endpoint, page, per_page,
            extra_params={"query": query}
        )
