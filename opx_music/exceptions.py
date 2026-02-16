"""
Custom exceptions for the OPX music ingestion pipeline.
"""


class OPXMusicError(Exception):
    """Base exception for all OPX music pipeline errors."""
    pass


class SourceConnectionError(OPXMusicError):
    """Failed to connect to the music source server."""

    def __init__(self, message: str, url: str = None, status_code: int = None):
        super().__init__(message)
        self.url = url
        self.status_code = status_code


class SourceAuthError(SourceConnectionError):
    """Authentication failed against the music source server."""
    pass


class DownloadError(OPXMusicError):
    """Failed to download a track file."""

    def __init__(self, message: str, track_id: str = None):
        super().__init__(message)
        self.track_id = track_id


class MetadataError(OPXMusicError):
    """Failed to extract or normalize track metadata."""

    def __init__(self, message: str, filepath: str = None):
        super().__init__(message)
        self.filepath = filepath


class ClassificationError(OPXMusicError):
    """Failed to classify a track."""
    pass


class RoutingError(OPXMusicError):
    """Failed to route a track to a publish folder."""

    def __init__(self, message: str, target_path: str = None):
        super().__init__(message)
        self.target_path = target_path


class AuditError(OPXMusicError):
    """Failed to write an audit log entry."""
    pass


class ConfigError(OPXMusicError):
    """Configuration error."""
    pass


class SchedulerError(OPXMusicError):
    """Scheduler-related error."""
    pass
