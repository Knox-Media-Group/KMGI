"""
Tests for Vimeo client reliability fixes.
"""

import pytest
import responses
from vimeo_roku_sdk.vimeo_client import VimeoClient
from vimeo_roku_sdk.exceptions import VimeoAPIError, VimeoAuthError


class TestVimeoClientErrorHandling:
    """Tests for API error handling robustness."""

    @responses.activate
    def test_non_json_error_response(self):
        """API error with HTML body should not crash on json parse."""
        responses.add(
            responses.GET,
            "https://api.vimeo.com/me/videos",
            body="<html><body>502 Bad Gateway</body></html>",
            status=502,
            content_type="text/html",
        )

        client = VimeoClient(access_token="test_token")

        with pytest.raises(VimeoAPIError) as exc_info:
            client.get_videos()

        assert exc_info.value.status_code == 502
        assert exc_info.value.response is None  # Not a JSON body

    @responses.activate
    def test_json_error_response(self):
        """API error with JSON body should parse correctly."""
        responses.add(
            responses.GET,
            "https://api.vimeo.com/me/videos",
            json={"error": "Something went wrong"},
            status=500,
        )

        client = VimeoClient(access_token="test_token")

        with pytest.raises(VimeoAPIError) as exc_info:
            client.get_videos()

        assert exc_info.value.status_code == 500
        assert exc_info.value.response == {"error": "Something went wrong"}

    @responses.activate
    def test_empty_error_response(self):
        """API error with empty body should not crash."""
        responses.add(
            responses.GET,
            "https://api.vimeo.com/me/videos",
            body="",
            status=500,
        )

        client = VimeoClient(access_token="test_token")

        with pytest.raises(VimeoAPIError) as exc_info:
            client.get_videos()

        assert exc_info.value.status_code == 500
        assert exc_info.value.response is None

    @responses.activate
    def test_auth_error(self):
        """401 response should raise VimeoAuthError."""
        responses.add(
            responses.GET,
            "https://api.vimeo.com/me/videos",
            json={"error": "Unauthorized"},
            status=401,
        )

        client = VimeoClient(access_token="bad_token")

        with pytest.raises(VimeoAuthError):
            client.get_videos()

    def test_missing_access_token(self):
        """Creating client without token should raise VimeoAuthError."""
        with pytest.raises(VimeoAuthError):
            VimeoClient(access_token="")
