"""
File Organization Module for KMGI Radio Automation

Handles organizing music files into proper folder structures
based on their metadata and categories.
"""

import os
import shutil
import logging
import re
from pathlib import Path
from typing import Dict, Optional, List, Tuple
from datetime import datetime

from ..analyzer.metadata import SongMetadata

logger = logging.getLogger(__name__)


class FileOrganizer:
    """Organizes music files into structured folders"""

    # Characters not allowed in file/folder names
    INVALID_CHARS = r'[<>:"/\\|?*]'

    # Default folder structure template
    DEFAULT_STRUCTURE = "{category}/{genre}/{artist}"

    # Default filename template
    DEFAULT_FILENAME = "{artist} - {title}"

    def __init__(self, config: Optional[Dict] = None):
        """
        Initialize the file organizer.

        Args:
            config: Configuration dictionary with paths and templates
        """
        self.config = config or {}

        # Get paths from config
        org_config = self.config.get('organization', {})
        self.root_path = Path(org_config.get('root', 'music'))
        self.structure_template = org_config.get('structure', self.DEFAULT_STRUCTURE)
        self.filename_template = org_config.get('filename', self.DEFAULT_FILENAME)

        # Quarantine for problematic files
        self.quarantine_path = Path(self.config.get('nurpe', {}).get(
            'quarantine', 'quarantine'))

    def organize_file(self, file_path: str, metadata: SongMetadata,
                      move: bool = True, dry_run: bool = False) -> Optional[str]:
        """
        Organize a single file based on its metadata.

        Args:
            file_path: Path to the source file
            metadata: Song metadata
            move: If True, move file; if False, copy
            dry_run: If True, only return destination without moving

        Returns:
            New file path if successful, None otherwise
        """
        source = Path(file_path)

        if not source.exists():
            logger.error(f"Source file not found: {source}")
            return None

        # Generate destination path
        dest_path = self._generate_destination(source, metadata)

        if dry_run:
            return str(dest_path)

        try:
            # Create destination directory
            dest_path.parent.mkdir(parents=True, exist_ok=True)

            # Handle filename conflicts
            dest_path = self._handle_conflict(dest_path)

            # Move or copy file
            if move:
                shutil.move(str(source), str(dest_path))
                logger.info(f"Moved: {source} -> {dest_path}")
            else:
                shutil.copy2(str(source), str(dest_path))
                logger.info(f"Copied: {source} -> {dest_path}")

            return str(dest_path)

        except Exception as e:
            logger.error(f"Error organizing {source}: {e}")
            return None

    def _generate_destination(self, source: Path, metadata: SongMetadata) -> Path:
        """Generate the destination path based on templates and metadata"""

        # Build substitution dictionary
        subs = {
            'category': self._sanitize(metadata.category or 'Uncategorized'),
            'genre': self._sanitize(metadata.genre or 'Unknown Genre'),
            'mood': self._sanitize(metadata.mood or 'Unknown Mood'),
            'tempo': self._sanitize(metadata.tempo or 'Unknown Tempo'),
            'gender': self._sanitize(metadata.gender or 'Unknown'),
            'artist': self._sanitize(metadata.artist or 'Unknown Artist'),
            'album': self._sanitize(metadata.album or 'Unknown Album'),
            'title': self._sanitize(metadata.title or source.stem),
            'year': str(metadata.year) if metadata.year else 'Unknown Year',
        }

        # Generate folder structure
        try:
            folder_path = self.structure_template.format(**subs)
        except KeyError as e:
            logger.warning(f"Invalid template variable: {e}, using default")
            folder_path = f"{subs['category']}/{subs['genre']}/{subs['artist']}"

        # Generate filename
        try:
            filename = self.filename_template.format(**subs)
        except KeyError as e:
            logger.warning(f"Invalid filename template variable: {e}")
            filename = f"{subs['artist']} - {subs['title']}"

        # Add extension
        filename = filename + source.suffix.lower()

        return self.root_path / folder_path / filename

    def _sanitize(self, name: str) -> str:
        """Sanitize a name for use in file paths"""
        # Remove invalid characters
        sanitized = re.sub(self.INVALID_CHARS, '', name)

        # Remove leading/trailing whitespace and dots
        sanitized = sanitized.strip('. ')

        # Replace multiple spaces with single space
        sanitized = re.sub(r'\s+', ' ', sanitized)

        # Limit length
        if len(sanitized) > 100:
            sanitized = sanitized[:100].strip()

        return sanitized or 'Unknown'

    def _handle_conflict(self, dest_path: Path) -> Path:
        """Handle filename conflicts by adding a number suffix"""
        if not dest_path.exists():
            return dest_path

        stem = dest_path.stem
        suffix = dest_path.suffix
        parent = dest_path.parent

        counter = 1
        while True:
            new_name = f"{stem} ({counter}){suffix}"
            new_path = parent / new_name
            if not new_path.exists():
                return new_path
            counter += 1

            if counter > 100:
                # Failsafe
                timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
                return parent / f"{stem}_{timestamp}{suffix}"

    def quarantine_file(self, file_path: str, reason: str = "") -> Optional[str]:
        """
        Move a problematic file to quarantine.

        Args:
            file_path: Path to the file
            reason: Reason for quarantine

        Returns:
            New path if successful
        """
        source = Path(file_path)

        if not source.exists():
            return None

        # Create quarantine directory
        self.quarantine_path.mkdir(parents=True, exist_ok=True)

        # Create log entry
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        dest = self.quarantine_path / f"{timestamp}_{source.name}"

        try:
            shutil.move(str(source), str(dest))
            logger.warning(f"Quarantined: {source} -> {dest}, Reason: {reason}")

            # Write reason to log file
            log_file = self.quarantine_path / "quarantine.log"
            with open(log_file, 'a') as f:
                f.write(f"{timestamp}|{source.name}|{reason}\n")

            return str(dest)

        except Exception as e:
            logger.error(f"Error quarantining {source}: {e}")
            return None

    def batch_organize(self, files: List[Tuple[str, SongMetadata]],
                       move: bool = True,
                       progress_callback=None) -> Dict[str, str]:
        """
        Organize multiple files.

        Args:
            files: List of (file_path, metadata) tuples
            move: If True, move files; if False, copy
            progress_callback: Optional callback(current, total, status)

        Returns:
            Dictionary mapping original paths to new paths
        """
        results = {}
        total = len(files)

        for i, (file_path, metadata) in enumerate(files):
            if progress_callback:
                progress_callback(i + 1, total, f"Organizing: {Path(file_path).name}")

            new_path = self.organize_file(file_path, metadata, move=move)
            if new_path:
                results[file_path] = new_path

        return results

    def get_folder_stats(self) -> Dict[str, Dict[str, int]]:
        """
        Get statistics about the organized folder structure.

        Returns:
            Nested dictionary with category/genre counts
        """
        stats = {}

        if not self.root_path.exists():
            return stats

        for category_dir in self.root_path.iterdir():
            if not category_dir.is_dir():
                continue

            category_name = category_dir.name
            stats[category_name] = {}

            for genre_dir in category_dir.iterdir():
                if not genre_dir.is_dir():
                    continue

                # Count audio files recursively
                count = sum(1 for f in genre_dir.rglob('*')
                           if f.is_file() and f.suffix.lower() in
                           ['.mp3', '.wav', '.flac', '.m4a', '.ogg'])

                stats[category_name][genre_dir.name] = count

        return stats

    def find_duplicates(self) -> List[List[str]]:
        """
        Find potential duplicate files based on filename similarity.

        Returns:
            List of lists, where each inner list contains paths of potential duplicates
        """
        files_by_key = {}

        if not self.root_path.exists():
            return []

        for file_path in self.root_path.rglob('*'):
            if not file_path.is_file():
                continue

            if file_path.suffix.lower() not in ['.mp3', '.wav', '.flac', '.m4a', '.ogg']:
                continue

            # Create a key from normalized filename
            key = re.sub(r'[^a-z0-9]', '', file_path.stem.lower())

            if key not in files_by_key:
                files_by_key[key] = []
            files_by_key[key].append(str(file_path))

        # Return only groups with duplicates
        return [paths for paths in files_by_key.values() if len(paths) > 1]

    def cleanup_empty_folders(self) -> int:
        """
        Remove empty folders from the organized directory.

        Returns:
            Number of folders removed
        """
        removed = 0

        if not self.root_path.exists():
            return removed

        # Walk bottom-up to remove empty directories
        for dirpath, dirnames, filenames in os.walk(str(self.root_path), topdown=False):
            if not dirnames and not filenames:
                try:
                    os.rmdir(dirpath)
                    removed += 1
                    logger.info(f"Removed empty folder: {dirpath}")
                except OSError:
                    pass

        return removed

    def validate_organization(self) -> Dict[str, List[str]]:
        """
        Validate the organization of files and find issues.

        Returns:
            Dictionary with issue types and affected file paths
        """
        issues = {
            'missing_category': [],
            'missing_genre': [],
            'invalid_characters': [],
            'too_long_path': [],
        }

        if not self.root_path.exists():
            return issues

        for file_path in self.root_path.rglob('*'):
            if not file_path.is_file():
                continue

            str_path = str(file_path)

            # Check path length (Windows limit)
            if len(str_path) > 260:
                issues['too_long_path'].append(str_path)

            # Check for 'Uncategorized' or 'Unknown' folders
            parts = file_path.relative_to(self.root_path).parts
            if len(parts) >= 1 and 'Uncategorized' in parts[0]:
                issues['missing_category'].append(str_path)
            if len(parts) >= 2 and 'Unknown' in parts[1]:
                issues['missing_genre'].append(str_path)

        return issues
