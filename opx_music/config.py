"""
Configuration for the OPX music ingestion pipeline.
"""

import os
import yaml
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from pathlib import Path

from .exceptions import ConfigError


@dataclass
class SourceConfig:
    """Music source server configuration."""
    server_url: str = ""
    api_key: str = ""
    username: str = ""
    password: str = ""
    download_dir: str = "./opx_downloads"
    timeout: int = 120
    max_retries: int = 4
    verify_ssl: bool = True

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SourceConfig":
        return cls(
            server_url=data.get("server_url", ""),
            api_key=data.get("api_key", ""),
            username=data.get("username", ""),
            password=data.get("password", ""),
            download_dir=data.get("download_dir", "./opx_downloads"),
            timeout=data.get("timeout", 120),
            max_retries=data.get("max_retries", 4),
            verify_ssl=data.get("verify_ssl", True),
        )

    @classmethod
    def from_env(cls) -> "SourceConfig":
        return cls(
            server_url=os.getenv("OPX_SOURCE_URL", ""),
            api_key=os.getenv("OPX_SOURCE_API_KEY", ""),
            username=os.getenv("OPX_SOURCE_USERNAME", ""),
            password=os.getenv("OPX_SOURCE_PASSWORD", ""),
            download_dir=os.getenv("OPX_DOWNLOAD_DIR", "./opx_downloads"),
            timeout=int(os.getenv("OPX_SOURCE_TIMEOUT", "120")),
            max_retries=int(os.getenv("OPX_SOURCE_MAX_RETRIES", "4")),
            verify_ssl=os.getenv("OPX_SOURCE_VERIFY_SSL", "true").lower() == "true",
        )


@dataclass
class WMXVConfig:
    """WMXV publish folder configuration."""
    publish_root: str = "./wmxv_publish"
    # Map of genre classification -> subfolder name
    genre_folders: Dict[str, str] = field(default_factory=lambda: {
        "Hot Rap": "hot_rap",
        "Hot R&B": "hot_rnb",
        "Hot Pop": "hot_pop",
        "Hot Country": "hot_country",
        "Hot Rock": "hot_rock",
        "Hot Latin": "hot_latin",
        "Hot Gospel": "hot_gospel",
        "Hot Dance": "hot_dance",
        "Hot Jazz": "hot_jazz",
        "Hot Classical": "hot_classical",
        "New Releases": "new_releases",
        "Unclassified": "unclassified",
    })

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WMXVConfig":
        return cls(
            publish_root=data.get("publish_root", "./wmxv_publish"),
            genre_folders=data.get("genre_folders", cls.__dataclass_fields__["genre_folders"].default_factory()),
        )

    @classmethod
    def from_env(cls) -> "WMXVConfig":
        return cls(
            publish_root=os.getenv("WMXV_PUBLISH_ROOT", "./wmxv_publish"),
        )


@dataclass
class ScheduleConfig:
    """Scheduler configuration."""
    enabled: bool = True
    cron_day: str = "sunday"  # Day of week for weekly job
    cron_time: str = "03:00"  # HH:MM format
    run_on_start: bool = False

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ScheduleConfig":
        return cls(
            enabled=data.get("enabled", True),
            cron_day=data.get("cron_day", "sunday"),
            cron_time=data.get("cron_time", "03:00"),
            run_on_start=data.get("run_on_start", False),
        )

    @classmethod
    def from_env(cls) -> "ScheduleConfig":
        return cls(
            enabled=os.getenv("OPX_SCHEDULE_ENABLED", "true").lower() == "true",
            cron_day=os.getenv("OPX_SCHEDULE_DAY", "sunday"),
            cron_time=os.getenv("OPX_SCHEDULE_TIME", "03:00"),
            run_on_start=os.getenv("OPX_SCHEDULE_RUN_ON_START", "false").lower() == "true",
        )


@dataclass
class MusicConfig:
    """Top-level configuration for the OPX music ingestion pipeline."""
    source: SourceConfig = field(default_factory=SourceConfig)
    wmxv: WMXVConfig = field(default_factory=WMXVConfig)
    schedule: ScheduleConfig = field(default_factory=ScheduleConfig)
    audit_log_path: str = "./opx_audit.log"
    state_path: str = "./.opx_state"
    log_level: str = "INFO"
    log_file: Optional[str] = None

    @classmethod
    def from_yaml(cls, filepath: str) -> "MusicConfig":
        path = Path(filepath)
        if not path.exists():
            raise ConfigError(f"Config file not found: {filepath}")
        try:
            with open(path, "r") as f:
                data = yaml.safe_load(f) or {}
        except yaml.YAMLError as e:
            raise ConfigError(f"Invalid YAML: {e}")

        return cls(
            source=SourceConfig.from_dict(data.get("source", {})),
            wmxv=WMXVConfig.from_dict(data.get("wmxv", {})),
            schedule=ScheduleConfig.from_dict(data.get("schedule", {})),
            audit_log_path=data.get("audit_log_path", "./opx_audit.log"),
            state_path=data.get("state_path", "./.opx_state"),
            log_level=data.get("log_level", "INFO"),
            log_file=data.get("log_file"),
        )

    @classmethod
    def from_env(cls) -> "MusicConfig":
        return cls(
            source=SourceConfig.from_env(),
            wmxv=WMXVConfig.from_env(),
            schedule=ScheduleConfig.from_env(),
            audit_log_path=os.getenv("OPX_AUDIT_LOG_PATH", "./opx_audit.log"),
            state_path=os.getenv("OPX_STATE_PATH", "./.opx_state"),
            log_level=os.getenv("OPX_LOG_LEVEL", "INFO"),
            log_file=os.getenv("OPX_LOG_FILE"),
        )

    @classmethod
    def from_yaml_with_env(cls, filepath: str) -> "MusicConfig":
        config = cls.from_yaml(filepath)
        if os.getenv("OPX_SOURCE_URL"):
            config.source = SourceConfig.from_env()
        if os.getenv("WMXV_PUBLISH_ROOT"):
            config.wmxv.publish_root = os.getenv("WMXV_PUBLISH_ROOT")
        return config

    def validate(self) -> List[str]:
        errors = []
        if not self.source.server_url:
            errors.append("Music source server_url is required")
        if not self.source.api_key and not (self.source.username and self.source.password):
            errors.append("Music source requires api_key or username+password")
        if not self.wmxv.publish_root:
            errors.append("WMXV publish_root is required")
        return errors

    def is_valid(self) -> bool:
        return len(self.validate()) == 0
