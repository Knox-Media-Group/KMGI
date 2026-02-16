#!/usr/bin/env python3
"""
OPX Music Ingestion CLI.

Usage:
    python music_ingest.py --once                       # Run one ingest pass
    python music_ingest.py --config opx_music.yaml      # Use config file
    python music_ingest.py --scheduled                  # Run weekly daemon
    python music_ingest.py --status                     # Show last run status
    python music_ingest.py --audit --limit 20           # Show recent audit entries
"""

import argparse
import logging
import sys
import os
import json
from pathlib import Path

# Allow running from scripts/ directory
sys.path.insert(0, str(Path(__file__).parent.parent))

from opx_music.config import MusicConfig
from opx_music.pipeline import MusicPipeline
from opx_music.audit import AuditLogger


def setup_logging(level: str = "INFO", log_file: str = None):
    log_level = getattr(logging, level.upper(), logging.INFO)
    handlers = [logging.StreamHandler(sys.stdout)]
    if log_file:
        handlers.append(logging.FileHandler(log_file))
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=handlers,
    )


def cmd_run_once(config: MusicConfig, args):
    pipeline = MusicPipeline(config)
    result = pipeline.run_once(since=args.since)

    print()
    print("OPX Music Ingest Results")
    print("=" * 50)
    print(f"Status:          {result.status}")
    print(f"Tracks listed:   {result.tracks_listed}")
    print(f"Downloaded:      {result.tracks_downloaded}")
    print(f"Ingested:        {result.tracks_ingested}")
    print(f"Classified:      {result.tracks_classified}")
    print(f"Routed:          {result.tracks_routed}")
    print(f"Published:       {result.tracks_published}")
    print(f"Failed:          {result.tracks_failed}")
    print(f"Duration:        {result.duration_seconds:.1f}s")

    if result.routed_details:
        print()
        print("Routed tracks:")
        for detail in result.routed_details:
            print(f"  [{detail['classification']}] {detail['artist']} - {detail['title']}")
            print(f"    -> {detail['dest_path']}")

    if result.errors:
        print()
        print(f"Errors ({len(result.errors)}):")
        for err in result.errors[:10]:
            print(f"  - {err}")
        if len(result.errors) > 10:
            print(f"  ... and {len(result.errors) - 10} more")

    return 0 if result.status == "completed" else 1


def cmd_scheduled(config: MusicConfig, args):
    pipeline = MusicPipeline(config)
    print(
        f"Starting weekly scheduler: {config.schedule.cron_day} "
        f"at {config.schedule.cron_time}"
    )
    print("Press Ctrl+C to stop.")
    pipeline.run_scheduled()
    return 0


def cmd_status(config: MusicConfig, args):
    audit = AuditLogger(config.audit_log_path)
    summary = audit.get_last_job_summary()

    if summary:
        print("Last job summary:")
        print(json.dumps(summary, indent=2))
    else:
        print("No previous job found in audit log.")

    return 0


def cmd_audit(config: MusicConfig, args):
    audit = AuditLogger(config.audit_log_path)
    entries = audit.read_log(limit=args.limit)

    if not entries:
        print("Audit log is empty.")
        return 0

    for entry in entries:
        ts = entry.get("timestamp", "")
        event = entry.get("event", "")
        if event == "track_published":
            print(
                f"[{ts}] PUBLISHED  {entry.get('track_id')}  "
                f"{entry.get('artist', '')} - {entry.get('title', '')}  "
                f"-> {entry.get('classification', '')}  "
                f"({entry.get('dest_path', '')})"
            )
        elif event == "job_complete":
            print(
                f"[{ts}] JOB_DONE   status={entry.get('status')} "
                f"ingested={entry.get('ingested')} "
                f"routed={entry.get('routed')} "
                f"failed={entry.get('failed')}"
            )
        elif event == "job_start":
            print(f"[{ts}] JOB_START  since={entry.get('since')}")
        else:
            print(f"[{ts}] {event}")

    return 0


def main():
    parser = argparse.ArgumentParser(
        prog="music_ingest",
        description="OPX Music Ingestion Pipeline for WMXV",
    )
    parser.add_argument(
        "-c", "--config",
        help="Path to YAML config file",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    parser.add_argument(
        "--log-file",
        help="Log file path",
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--once",
        action="store_true",
        help="Run a single ingest pass and exit",
    )
    group.add_argument(
        "--scheduled",
        action="store_true",
        help="Start the weekly scheduled daemon",
    )
    group.add_argument(
        "--status",
        action="store_true",
        help="Show the last job status from audit log",
    )
    group.add_argument(
        "--audit",
        action="store_true",
        help="Show recent audit log entries",
    )

    parser.add_argument(
        "--since",
        help="ISO datetime — only ingest tracks newer than this (--once mode)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Number of audit entries to show (--audit mode, default 50)",
    )

    args = parser.parse_args()

    setup_logging(args.log_level, args.log_file)

    # Load config
    if args.config:
        if not Path(args.config).exists():
            print(f"Config file not found: {args.config}")
            sys.exit(1)
        config = MusicConfig.from_yaml_with_env(args.config)
    else:
        config = MusicConfig.from_env()

    if args.once:
        return cmd_run_once(config, args)
    elif args.scheduled:
        return cmd_scheduled(config, args)
    elif args.status:
        return cmd_status(config, args)
    elif args.audit:
        return cmd_audit(config, args)


if __name__ == "__main__":
    sys.exit(main() or 0)
