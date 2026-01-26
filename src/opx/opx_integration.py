"""
OP-X Radio Automation Integration Module

Handles syncing music library data with OP-X radio automation software.
OP-X typically uses Microsoft Access (.mdb) or SQL Server databases.
"""

import os
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
import struct

from ..database.models import Song
from ..database.db import DatabaseManager

logger = logging.getLogger(__name__)


class OPXIntegration:
    """
    Integration with OP-X radio automation software.

    OP-X stores its music library in a database that can be:
    - Microsoft Access (.mdb/.accdb)
    - SQL Server
    - XML export files

    This class provides methods to sync between KMGI and OP-X.
    """

    # OP-X field mappings (OP-X field -> KMGI field)
    FIELD_MAPPINGS = {
        'Title': 'title',
        'Artist': 'artist',
        'Album': 'album',
        'Year': 'year',
        'Genre': 'genre',
        'Category': 'category',
        'Tempo': 'tempo',
        'BPM': 'tempo_bpm',
        'Intro': 'intro_seconds',
        'Outro': 'outro_seconds',
        'Duration': 'duration_seconds',
        'FileName': 'file_path',
        'Gender': 'gender',
        'Mood': 'mood',
        'Energy': 'energy',
        'Explicit': 'explicit',
        'DateAdded': 'date_added',
        'LastPlayed': 'last_played',
        'PlayCount': 'play_count',
    }

    # OP-X category code mappings
    CATEGORY_CODES = {
        'CUR': 'Current',
        'REC': 'Recurrent',
        'PWG': 'Power Gold',
        'GLD': 'Gold',
        'DPC': 'Deep Cut',
    }

    def __init__(self, config: Dict = None, db: DatabaseManager = None):
        """
        Initialize OP-X integration.

        Args:
            config: Configuration dictionary with OP-X settings
            db: KMGI database manager
        """
        self.config = config or {}
        self.db = db

        opx_config = self.config.get('opx', {})
        self.opx_db_path = opx_config.get('database', '')
        self.opx_version = opx_config.get('version', '3.0')
        self.sync_fields = opx_config.get('sync_fields', list(self.FIELD_MAPPINGS.values()))

        self._pyodbc = None
        self._connection = None

    def _load_odbc(self):
        """Lazy load pyodbc for database access"""
        if self._pyodbc is None:
            try:
                import pyodbc
                self._pyodbc = pyodbc
                logger.info("pyodbc loaded successfully")
            except ImportError:
                logger.warning("pyodbc not available - Access database integration disabled")
                logger.info("Install with: pip install pyodbc")

    def connect(self) -> bool:
        """
        Connect to OP-X database.

        Returns:
            True if connection successful
        """
        self._load_odbc()

        if self._pyodbc is None:
            return False

        if not self.opx_db_path or not Path(self.opx_db_path).exists():
            logger.error(f"OP-X database not found: {self.opx_db_path}")
            return False

        try:
            # Build connection string for Access database
            conn_str = (
                r'DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};'
                f'DBQ={self.opx_db_path};'
            )

            self._connection = self._pyodbc.connect(conn_str)
            logger.info(f"Connected to OP-X database: {self.opx_db_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to OP-X database: {e}")
            return False

    def disconnect(self):
        """Close connection to OP-X database"""
        if self._connection:
            self._connection.close()
            self._connection = None
            logger.info("Disconnected from OP-X database")

    def get_opx_songs(self, table_name: str = "Library") -> List[Dict[str, Any]]:
        """
        Get all songs from OP-X database.

        Args:
            table_name: Name of the library table in OP-X

        Returns:
            List of song dictionaries
        """
        if not self._connection:
            if not self.connect():
                return []

        try:
            cursor = self._connection.cursor()
            cursor.execute(f"SELECT * FROM [{table_name}]")

            columns = [column[0] for column in cursor.description]
            songs = []

            for row in cursor.fetchall():
                song_dict = dict(zip(columns, row))
                songs.append(song_dict)

            logger.info(f"Retrieved {len(songs)} songs from OP-X")
            return songs

        except Exception as e:
            logger.error(f"Error reading OP-X database: {e}")
            return []

    def sync_to_opx(self, songs: List[Song] = None) -> Dict[str, int]:
        """
        Sync songs from KMGI to OP-X database.

        Args:
            songs: List of songs to sync (all if None)

        Returns:
            Dictionary with sync statistics
        """
        stats = {'added': 0, 'updated': 0, 'errors': 0}

        if not self._connection:
            if not self.connect():
                return stats

        if songs is None and self.db:
            with self.db.session_scope() as session:
                songs = session.query(Song).filter_by(is_active=True).all()

        for song in songs:
            try:
                if self._song_exists_in_opx(song.file_path):
                    if self._update_opx_song(song):
                        stats['updated'] += 1
                else:
                    if self._insert_opx_song(song):
                        stats['added'] += 1
            except Exception as e:
                logger.error(f"Error syncing song {song.title}: {e}")
                stats['errors'] += 1

        self._connection.commit()
        logger.info(f"OP-X sync complete: {stats}")
        return stats

    def sync_from_opx(self) -> Dict[str, int]:
        """
        Sync songs from OP-X to KMGI database.

        Returns:
            Dictionary with sync statistics
        """
        stats = {'added': 0, 'updated': 0, 'errors': 0}

        opx_songs = self.get_opx_songs()

        for opx_song in opx_songs:
            try:
                kmgi_data = self._map_opx_to_kmgi(opx_song)

                if self.db:
                    existing = self.db.get_song_by_path(kmgi_data.get('file_path', ''))

                    if existing:
                        # Update existing song with OP-X data
                        for key, value in kmgi_data.items():
                            if hasattr(existing, key) and value is not None:
                                setattr(existing, key, value)
                        stats['updated'] += 1
                    else:
                        self.db.add_song(kmgi_data)
                        stats['added'] += 1

            except Exception as e:
                logger.error(f"Error importing from OP-X: {e}")
                stats['errors'] += 1

        logger.info(f"OP-X import complete: {stats}")
        return stats

    def _song_exists_in_opx(self, file_path: str, table_name: str = "Library") -> bool:
        """Check if a song exists in OP-X by file path"""
        try:
            cursor = self._connection.cursor()
            cursor.execute(
                f"SELECT COUNT(*) FROM [{table_name}] WHERE FileName = ?",
                (file_path,)
            )
            count = cursor.fetchone()[0]
            return count > 0
        except Exception:
            return False

    def _insert_opx_song(self, song: Song, table_name: str = "Library") -> bool:
        """Insert a new song into OP-X database"""
        try:
            fields = []
            values = []
            placeholders = []

            for opx_field, kmgi_field in self.FIELD_MAPPINGS.items():
                if kmgi_field in self.sync_fields and hasattr(song, kmgi_field):
                    value = getattr(song, kmgi_field)
                    if value is not None:
                        fields.append(f"[{opx_field}]")
                        values.append(self._convert_value_for_opx(value))
                        placeholders.append("?")

            if not fields:
                return False

            sql = f"INSERT INTO [{table_name}] ({', '.join(fields)}) VALUES ({', '.join(placeholders)})"

            cursor = self._connection.cursor()
            cursor.execute(sql, values)
            return True

        except Exception as e:
            logger.error(f"Error inserting song to OP-X: {e}")
            return False

    def _update_opx_song(self, song: Song, table_name: str = "Library") -> bool:
        """Update an existing song in OP-X database"""
        try:
            updates = []
            values = []

            for opx_field, kmgi_field in self.FIELD_MAPPINGS.items():
                if kmgi_field in self.sync_fields and hasattr(song, kmgi_field):
                    if kmgi_field != 'file_path':  # Don't update the key field
                        value = getattr(song, kmgi_field)
                        if value is not None:
                            updates.append(f"[{opx_field}] = ?")
                            values.append(self._convert_value_for_opx(value))

            if not updates:
                return False

            values.append(song.file_path)
            sql = f"UPDATE [{table_name}] SET {', '.join(updates)} WHERE FileName = ?"

            cursor = self._connection.cursor()
            cursor.execute(sql, values)
            return True

        except Exception as e:
            logger.error(f"Error updating song in OP-X: {e}")
            return False

    def _map_opx_to_kmgi(self, opx_data: Dict[str, Any]) -> Dict[str, Any]:
        """Map OP-X field names to KMGI field names"""
        kmgi_data = {}

        for opx_field, kmgi_field in self.FIELD_MAPPINGS.items():
            if opx_field in opx_data:
                value = opx_data[opx_field]
                if value is not None:
                    kmgi_data[kmgi_field] = self._convert_value_from_opx(kmgi_field, value)

        return kmgi_data

    def _convert_value_for_opx(self, value: Any) -> Any:
        """Convert KMGI value to OP-X compatible format"""
        if isinstance(value, datetime):
            return value.strftime('%Y-%m-%d %H:%M:%S')
        if isinstance(value, bool):
            return 1 if value else 0
        return value

    def _convert_value_from_opx(self, field: str, value: Any) -> Any:
        """Convert OP-X value to KMGI format"""
        if field in ['date_added', 'last_played'] and value:
            if isinstance(value, str):
                try:
                    return datetime.strptime(value, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    return None
            return value
        if field == 'explicit':
            return bool(value)
        return value

    # XML Export/Import for OP-X

    def export_to_xml(self, output_path: str, songs: List[Song] = None) -> bool:
        """
        Export songs to XML format compatible with OP-X import.

        Args:
            output_path: Path for output XML file
            songs: Songs to export (all active if None)

        Returns:
            True if export successful
        """
        import xml.etree.ElementTree as ET

        if songs is None and self.db:
            with self.db.session_scope() as session:
                songs = session.query(Song).filter_by(is_active=True).all()

        root = ET.Element("OPXLibrary")
        root.set("version", self.opx_version)
        root.set("exported", datetime.utcnow().isoformat())

        for song in songs:
            song_elem = ET.SubElement(root, "Song")

            for opx_field, kmgi_field in self.FIELD_MAPPINGS.items():
                if hasattr(song, kmgi_field):
                    value = getattr(song, kmgi_field)
                    if value is not None:
                        field_elem = ET.SubElement(song_elem, opx_field)
                        field_elem.text = str(self._convert_value_for_opx(value))

        tree = ET.ElementTree(root)
        tree.write(output_path, encoding='utf-8', xml_declaration=True)
        logger.info(f"Exported {len(songs)} songs to {output_path}")
        return True

    def import_from_xml(self, input_path: str) -> Dict[str, int]:
        """
        Import songs from OP-X XML export.

        Args:
            input_path: Path to XML file

        Returns:
            Import statistics
        """
        import xml.etree.ElementTree as ET

        stats = {'added': 0, 'updated': 0, 'errors': 0}

        try:
            tree = ET.parse(input_path)
            root = tree.getroot()

            for song_elem in root.findall('Song'):
                try:
                    opx_data = {}
                    for child in song_elem:
                        opx_data[child.tag] = child.text

                    kmgi_data = self._map_opx_to_kmgi(opx_data)

                    if self.db and kmgi_data.get('file_path'):
                        existing = self.db.get_song_by_path(kmgi_data['file_path'])
                        if existing:
                            stats['updated'] += 1
                        else:
                            stats['added'] += 1
                        self.db.add_song(kmgi_data)

                except Exception as e:
                    logger.error(f"Error importing song: {e}")
                    stats['errors'] += 1

            logger.info(f"XML import complete: {stats}")

        except Exception as e:
            logger.error(f"Error parsing XML file: {e}")

        return stats

    def get_opx_play_history(self, days: int = 7) -> List[Dict[str, Any]]:
        """
        Get play history from OP-X for auditing.

        Args:
            days: Number of days of history to retrieve

        Returns:
            List of play records
        """
        if not self._connection:
            if not self.connect():
                return []

        try:
            cursor = self._connection.cursor()

            # OP-X typically has a PlayLog or History table
            # Table name may vary by version
            for table_name in ['PlayLog', 'PlayHistory', 'History', 'Log']:
                try:
                    cursor.execute(f"SELECT * FROM [{table_name}] ORDER BY PlayTime DESC")
                    columns = [column[0] for column in cursor.description]

                    plays = []
                    for row in cursor.fetchall():
                        plays.append(dict(zip(columns, row)))

                    logger.info(f"Retrieved {len(plays)} play records from OP-X")
                    return plays

                except Exception:
                    continue

            logger.warning("Could not find OP-X play history table")
            return []

        except Exception as e:
            logger.error(f"Error reading OP-X play history: {e}")
            return []

    def verify_library_sync(self) -> Dict[str, List[str]]:
        """
        Verify sync status between KMGI and OP-X.

        Returns:
            Dictionary with 'missing_in_opx' and 'missing_in_kmgi' file paths
        """
        results = {
            'missing_in_opx': [],
            'missing_in_kmgi': [],
            'sync_ok': 0
        }

        opx_songs = self.get_opx_songs()
        opx_paths = {s.get('FileName', '') for s in opx_songs}

        if self.db:
            with self.db.session_scope() as session:
                kmgi_songs = session.query(Song).filter_by(is_active=True).all()
                kmgi_paths = {s.file_path for s in kmgi_songs}

                results['missing_in_opx'] = list(kmgi_paths - opx_paths)
                results['missing_in_kmgi'] = list(opx_paths - kmgi_paths)
                results['sync_ok'] = len(kmgi_paths & opx_paths)

        return results
