"""
Nurpe Download Folder Watcher

Monitors a folder for new music downloads from Nurpe and automatically
processes them through the categorization pipeline.
"""

import os
import time
import logging
import threading
from pathlib import Path
from typing import Optional, Callable, List, Dict, Any
from datetime import datetime
from queue import Queue

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileCreatedEvent, FileMovedEvent

from ..analyzer.audio_analyzer import AudioAnalyzer
from ..analyzer.metadata import MetadataManager
from ..organizer.file_organizer import FileOrganizer
from ..database.db import DatabaseManager

logger = logging.getLogger(__name__)


class NurpeMusicHandler(FileSystemEventHandler):
    """Handles file system events for new music files"""

    AUDIO_EXTENSIONS = {'.mp3', '.wav', '.flac', '.m4a', '.ogg', '.wma', '.aac'}

    def __init__(self, file_queue: Queue, extensions: set = None):
        """
        Initialize the handler.

        Args:
            file_queue: Queue to add new files to
            extensions: Set of audio extensions to watch
        """
        self.file_queue = file_queue
        self.extensions = extensions or self.AUDIO_EXTENSIONS
        self._processing_files = set()

    def on_created(self, event):
        """Handle file creation events"""
        if event.is_directory:
            return

        self._handle_new_file(event.src_path)

    def on_moved(self, event):
        """Handle file move events (for renamed/moved files)"""
        if event.is_directory:
            return

        self._handle_new_file(event.dest_path)

    def _handle_new_file(self, file_path: str):
        """Process a new file"""
        path = Path(file_path)

        # Check if it's an audio file
        if path.suffix.lower() not in self.extensions:
            return

        # Skip if already being processed
        if file_path in self._processing_files:
            return

        # Wait for file to be fully written
        self._wait_for_complete(file_path)

        # Add to processing queue
        self._processing_files.add(file_path)
        self.file_queue.put(file_path)
        logger.info(f"New file detected: {path.name}")

    def _wait_for_complete(self, file_path: str, timeout: int = 60):
        """Wait for a file to be completely written"""
        start_time = time.time()
        last_size = -1

        while time.time() - start_time < timeout:
            try:
                current_size = os.path.getsize(file_path)
                if current_size == last_size and current_size > 0:
                    time.sleep(0.5)  # Extra wait to be sure
                    return True
                last_size = current_size
                time.sleep(1)
            except OSError:
                time.sleep(1)

        return False

    def mark_processed(self, file_path: str):
        """Mark a file as processed"""
        self._processing_files.discard(file_path)


class NurpeWatcher:
    """
    Watches for new music files from Nurpe downloads and processes them.

    Processing includes:
    1. Analyzing audio characteristics
    2. Reading/updating metadata
    3. Categorizing by genre, mood, tempo
    4. Organizing into proper folder structure
    5. Adding to database
    6. Syncing with OP-X
    """

    def __init__(self, config: Dict = None, db: DatabaseManager = None):
        """
        Initialize the Nurpe watcher.

        Args:
            config: Configuration dictionary
            db: Database manager instance
        """
        self.config = config or {}
        self.db = db

        nurpe_config = self.config.get('nurpe', {})
        self.watch_path = Path(nurpe_config.get('downloads', 'downloads'))
        self.extensions = set(nurpe_config.get('extensions', ['.mp3', '.wav', '.flac', '.m4a']))
        self.auto_categorize = nurpe_config.get('auto_categorize', True)
        self.move_files = nurpe_config.get('move_files', True)

        # Initialize components
        self.analyzer = AudioAnalyzer(config)
        self.metadata_manager = MetadataManager(config)
        self.organizer = FileOrganizer(config)

        # Processing queue and thread
        self.file_queue = Queue()
        self.handler = NurpeMusicHandler(self.file_queue, self.extensions)
        self.observer = None
        self._processing_thread = None
        self._stop_event = threading.Event()

        # Callbacks for processing events
        self.on_file_processed: Optional[Callable[[str, Dict], None]] = None
        self.on_file_error: Optional[Callable[[str, Exception], None]] = None
        self.on_status_change: Optional[Callable[[str], None]] = None

    def start(self):
        """Start watching for new files"""
        if not self.watch_path.exists():
            self.watch_path.mkdir(parents=True)
            logger.info(f"Created watch directory: {self.watch_path}")

        # Start the file system observer
        self.observer = Observer()
        self.observer.schedule(self.handler, str(self.watch_path), recursive=True)
        self.observer.start()

        # Start the processing thread
        self._stop_event.clear()
        self._processing_thread = threading.Thread(target=self._process_queue, daemon=True)
        self._processing_thread.start()

        logger.info(f"Started watching: {self.watch_path}")
        if self.on_status_change:
            self.on_status_change("watching")

    def stop(self):
        """Stop watching for new files"""
        self._stop_event.set()

        if self.observer:
            self.observer.stop()
            self.observer.join(timeout=5)

        if self._processing_thread:
            self._processing_thread.join(timeout=5)

        logger.info("Stopped watching")
        if self.on_status_change:
            self.on_status_change("stopped")

    def _process_queue(self):
        """Process files from the queue"""
        while not self._stop_event.is_set():
            try:
                # Get file from queue with timeout
                file_path = self.file_queue.get(timeout=1)

                try:
                    result = self.process_file(file_path)
                    if self.on_file_processed:
                        self.on_file_processed(file_path, result)
                except Exception as e:
                    logger.error(f"Error processing {file_path}: {e}")
                    if self.on_file_error:
                        self.on_file_error(file_path, e)
                finally:
                    self.handler.mark_processed(file_path)
                    self.file_queue.task_done()

            except Exception:
                # Queue timeout, continue loop
                continue

    def process_file(self, file_path: str) -> Dict[str, Any]:
        """
        Process a single music file.

        Args:
            file_path: Path to the audio file

        Returns:
            Processing result dictionary
        """
        result = {
            'file_path': file_path,
            'status': 'processing',
            'analysis': None,
            'metadata': None,
            'new_path': None,
            'errors': []
        }

        logger.info(f"Processing: {Path(file_path).name}")

        # Step 1: Read existing metadata
        metadata = self.metadata_manager.read_metadata(file_path)
        if not metadata:
            result['errors'].append("Failed to read metadata")
            self.organizer.quarantine_file(file_path, "Metadata read failed")
            result['status'] = 'error'
            return result

        result['metadata'] = metadata.to_dict()

        # Step 2: Analyze audio if auto-categorize is enabled
        if self.auto_categorize:
            analysis = self.analyzer.analyze_file(file_path)
            if analysis:
                result['analysis'] = analysis.to_dict()

                # Update metadata with analysis results
                metadata = self.metadata_manager.update_from_analysis(metadata, analysis)

                # Write updated metadata back to file
                self.metadata_manager.write_metadata(file_path, metadata)
            else:
                result['errors'].append("Audio analysis failed - using existing metadata")

        # Step 3: Determine category if not set
        if not metadata.category:
            metadata.category = self._suggest_category(metadata)

        # Step 4: Determine gender if not set
        if not metadata.gender:
            metadata.gender = self._suggest_gender(metadata)

        # Step 5: Organize file into proper folder
        new_path = self.organizer.organize_file(
            file_path,
            metadata,
            move=self.move_files
        )

        if new_path:
            result['new_path'] = new_path
            metadata.file_path = new_path
        else:
            result['errors'].append("Failed to organize file")

        # Step 6: Add to database
        if self.db:
            try:
                song_data = metadata.to_dict()
                song_data['file_path'] = new_path or file_path
                song_data['date_added'] = datetime.utcnow()
                song_data['last_analyzed'] = datetime.utcnow()

                if result.get('analysis'):
                    song_data['analysis_confidence'] = result['analysis'].get('confidence', 0)

                self.db.add_song(song_data)
                logger.info(f"Added to database: {metadata.title} - {metadata.artist}")

            except Exception as e:
                result['errors'].append(f"Database error: {e}")

        result['status'] = 'success' if not result['errors'] else 'partial'
        result['metadata'] = metadata.to_dict()

        logger.info(f"Processed: {metadata.artist} - {metadata.title} [{metadata.category}]")
        return result

    def _suggest_category(self, metadata) -> str:
        """Suggest a category for new music"""
        # New downloads typically go to Current
        # Could add logic based on release date, familiarity, etc.
        return "Current"

    def _suggest_gender(self, metadata) -> str:
        """Suggest gender classification based on available info"""
        artist = metadata.artist.lower() if metadata.artist else ""

        # Check for common group indicators
        group_indicators = ['band', 'brothers', 'sisters', 'boys', 'girls', 'crew', '&', 'and', 'feat']
        if any(ind in artist for ind in group_indicators):
            return "Group"

        # Check if instrumental
        if metadata.is_instrumental:
            return "Instrumental"

        # Default - would need ML model or manual assignment for accurate classification
        return ""

    def scan_existing(self) -> Dict[str, int]:
        """
        Scan the watch folder for existing files and process them.

        Returns:
            Statistics about processed files
        """
        stats = {'processed': 0, 'errors': 0, 'skipped': 0}

        if not self.watch_path.exists():
            return stats

        for file_path in self.watch_path.rglob('*'):
            if not file_path.is_file():
                continue

            if file_path.suffix.lower() not in self.extensions:
                continue

            # Check if already in database
            if self.db:
                existing = self.db.get_song_by_path(str(file_path))
                if existing:
                    stats['skipped'] += 1
                    continue

            try:
                self.process_file(str(file_path))
                stats['processed'] += 1
            except Exception as e:
                logger.error(f"Error processing {file_path}: {e}")
                stats['errors'] += 1

        logger.info(f"Scan complete: {stats}")
        return stats

    def get_status(self) -> Dict[str, Any]:
        """Get current watcher status"""
        return {
            'watching': self.observer.is_alive() if self.observer else False,
            'watch_path': str(self.watch_path),
            'queue_size': self.file_queue.qsize(),
            'extensions': list(self.extensions),
            'auto_categorize': self.auto_categorize,
            'move_files': self.move_files,
        }

    def process_single(self, file_path: str) -> Dict[str, Any]:
        """Process a single file immediately (not through queue)"""
        return self.process_file(file_path)

    def batch_process(self, file_paths: List[str],
                      progress_callback: Callable = None) -> List[Dict[str, Any]]:
        """
        Process multiple files with progress tracking.

        Args:
            file_paths: List of file paths to process
            progress_callback: Optional callback(current, total, filename)

        Returns:
            List of processing results
        """
        results = []
        total = len(file_paths)

        for i, file_path in enumerate(file_paths):
            if progress_callback:
                progress_callback(i + 1, total, Path(file_path).name)

            result = self.process_file(file_path)
            results.append(result)

        return results
