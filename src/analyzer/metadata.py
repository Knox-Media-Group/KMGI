"""
Metadata Management Module for KMGI Radio Automation

Handles reading and writing audio file metadata (ID3 tags, etc.)
"""

import os
import logging
from pathlib import Path
from typing import Dict, Optional, Any, List
from dataclasses import dataclass, field, asdict
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class SongMetadata:
    """Complete metadata for a song"""
    # Basic info
    title: str = ""
    artist: str = ""
    album: str = ""
    album_artist: str = ""
    year: Optional[int] = None
    track_number: Optional[int] = None
    genre: str = ""

    # Radio-specific fields
    category: str = ""  # Current, Recurrent, Gold, etc.
    mood: str = ""
    tempo: str = ""  # Slow, Medium, Fast
    tempo_bpm: Optional[float] = None
    gender: str = ""  # Male, Female, Group, Mixed, Instrumental
    energy: str = ""  # Low, Medium, High

    # Timing info (for radio automation)
    duration_seconds: float = 0.0
    intro_seconds: float = 0.0
    outro_seconds: float = 0.0
    hook_start: Optional[float] = None
    hook_end: Optional[float] = None

    # Technical info
    bitrate: Optional[int] = None
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
    file_format: str = ""
    file_size_bytes: int = 0

    # Library management
    date_added: Optional[datetime] = None
    last_modified: Optional[datetime] = None
    play_count: int = 0
    last_played: Optional[datetime] = None
    rating: Optional[int] = None  # 1-5

    # Content flags
    explicit: bool = False
    has_intro: bool = False
    has_outro: bool = False
    is_instrumental: bool = False
    is_remix: bool = False
    is_live: bool = False
    is_acoustic: bool = False

    # Custom fields (for OP-X compatibility)
    custom_fields: Dict[str, Any] = field(default_factory=dict)

    # File reference
    file_path: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = asdict(self)
        # Convert datetime objects to ISO format strings
        for key in ['date_added', 'last_modified', 'last_played']:
            if data[key] is not None:
                data[key] = data[key].isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SongMetadata':
        """Create from dictionary"""
        # Convert ISO format strings back to datetime
        for key in ['date_added', 'last_modified', 'last_played']:
            if data.get(key) and isinstance(data[key], str):
                data[key] = datetime.fromisoformat(data[key])
        return cls(**data)


class MetadataManager:
    """Manages reading and writing audio file metadata"""

    # Mapping of genre variations to standardized genres
    GENRE_NORMALIZATION = {
        'hip hop': 'Hip-Hop',
        'hiphop': 'Hip-Hop',
        'hip-hop': 'Hip-Hop',
        'rap': 'Hip-Hop',
        'r&b': 'R&B',
        'rnb': 'R&B',
        'rhythm and blues': 'R&B',
        'pop': 'Pop',
        'rock': 'Rock',
        'alternative': 'Alternative',
        'alt': 'Alternative',
        'country': 'Country',
        'electronic': 'Electronic',
        'edm': 'Electronic',
        'dance': 'Electronic',
        'jazz': 'Jazz',
        'classical': 'Classical',
        'latin': 'Latin',
        'reggae': 'Reggae',
        'indie': 'Indie',
    }

    # Custom TXXX frame names for radio metadata
    RADIO_FRAMES = {
        'category': 'KMGI_CATEGORY',
        'mood': 'KMGI_MOOD',
        'tempo': 'KMGI_TEMPO',
        'tempo_bpm': 'KMGI_BPM',
        'gender': 'KMGI_GENDER',
        'energy': 'KMGI_ENERGY',
        'intro_seconds': 'KMGI_INTRO',
        'outro_seconds': 'KMGI_OUTRO',
        'hook_start': 'KMGI_HOOK_START',
        'hook_end': 'KMGI_HOOK_END',
        'explicit': 'KMGI_EXPLICIT',
        'play_count': 'KMGI_PLAY_COUNT',
        'last_played': 'KMGI_LAST_PLAYED',
    }

    def __init__(self, config: Optional[Dict] = None):
        """Initialize the metadata manager"""
        self.config = config or {}
        self._mutagen = None
        self._tinytag = None
        self._load_libraries()

    def _load_libraries(self):
        """Load metadata handling libraries"""
        try:
            import mutagen
            self._mutagen = mutagen
            logger.info("Mutagen loaded successfully")
        except ImportError:
            logger.warning("Mutagen not available - metadata writing disabled")

        try:
            from tinytag import TinyTag
            self._tinytag = TinyTag
            logger.info("TinyTag loaded successfully")
        except ImportError:
            logger.warning("TinyTag not available")

    def read_metadata(self, file_path: str) -> Optional[SongMetadata]:
        """
        Read metadata from an audio file.

        Args:
            file_path: Path to the audio file

        Returns:
            SongMetadata object or None if reading fails
        """
        file_path = Path(file_path)

        if not file_path.exists():
            logger.error(f"File not found: {file_path}")
            return None

        try:
            metadata = SongMetadata(file_path=str(file_path))

            # Get file info
            stat = file_path.stat()
            metadata.file_size_bytes = stat.st_size
            metadata.last_modified = datetime.fromtimestamp(stat.st_mtime)
            metadata.file_format = file_path.suffix.lower().lstrip('.')

            # Try mutagen first for detailed metadata
            if self._mutagen:
                self._read_with_mutagen(file_path, metadata)
            elif self._tinytag:
                self._read_with_tinytag(file_path, metadata)

            # Normalize genre
            metadata.genre = self._normalize_genre(metadata.genre)

            return metadata

        except Exception as e:
            logger.error(f"Error reading metadata from {file_path}: {e}")
            return None

    def _read_with_mutagen(self, file_path: Path, metadata: SongMetadata):
        """Read metadata using Mutagen library"""
        from mutagen import File
        from mutagen.id3 import ID3
        from mutagen.mp3 import MP3
        from mutagen.flac import FLAC
        from mutagen.mp4 import MP4

        audio = File(str(file_path))
        if audio is None:
            return

        # Get technical info
        if hasattr(audio, 'info'):
            info = audio.info
            metadata.duration_seconds = getattr(info, 'length', 0)
            metadata.bitrate = getattr(info, 'bitrate', None)
            metadata.sample_rate = getattr(info, 'sample_rate', None)
            metadata.channels = getattr(info, 'channels', None)

        # Handle different formats
        suffix = file_path.suffix.lower()

        if suffix == '.mp3':
            self._read_mp3_tags(audio, metadata)
        elif suffix == '.flac':
            self._read_vorbis_tags(audio, metadata)
        elif suffix in ['.m4a', '.mp4', '.aac']:
            self._read_mp4_tags(audio, metadata)
        elif suffix == '.ogg':
            self._read_vorbis_tags(audio, metadata)

    def _read_mp3_tags(self, audio, metadata: SongMetadata):
        """Read ID3 tags from MP3 file"""
        if audio.tags is None:
            return

        tags = audio.tags

        # Standard tags
        metadata.title = str(tags.get('TIT2', [''])[0]) if 'TIT2' in tags else ""
        metadata.artist = str(tags.get('TPE1', [''])[0]) if 'TPE1' in tags else ""
        metadata.album = str(tags.get('TALB', [''])[0]) if 'TALB' in tags else ""
        metadata.album_artist = str(tags.get('TPE2', [''])[0]) if 'TPE2' in tags else ""
        metadata.genre = str(tags.get('TCON', [''])[0]) if 'TCON' in tags else ""

        # Year
        if 'TDRC' in tags:
            try:
                metadata.year = int(str(tags['TDRC'][0])[:4])
            except (ValueError, IndexError):
                pass
        elif 'TYER' in tags:
            try:
                metadata.year = int(str(tags['TYER'][0]))
            except (ValueError, IndexError):
                pass

        # Track number
        if 'TRCK' in tags:
            try:
                track_str = str(tags['TRCK'][0])
                metadata.track_number = int(track_str.split('/')[0])
            except (ValueError, IndexError):
                pass

        # Custom TXXX frames for radio metadata
        for frame in tags.getall('TXXX'):
            desc = frame.desc
            value = str(frame.text[0]) if frame.text else ""

            if desc == self.RADIO_FRAMES['category']:
                metadata.category = value
            elif desc == self.RADIO_FRAMES['mood']:
                metadata.mood = value
            elif desc == self.RADIO_FRAMES['tempo']:
                metadata.tempo = value
            elif desc == self.RADIO_FRAMES['tempo_bpm']:
                try:
                    metadata.tempo_bpm = float(value)
                except ValueError:
                    pass
            elif desc == self.RADIO_FRAMES['gender']:
                metadata.gender = value
            elif desc == self.RADIO_FRAMES['energy']:
                metadata.energy = value
            elif desc == self.RADIO_FRAMES['intro_seconds']:
                try:
                    metadata.intro_seconds = float(value)
                except ValueError:
                    pass
            elif desc == self.RADIO_FRAMES['outro_seconds']:
                try:
                    metadata.outro_seconds = float(value)
                except ValueError:
                    pass
            elif desc == self.RADIO_FRAMES['explicit']:
                metadata.explicit = value.lower() == 'true'

    def _read_vorbis_tags(self, audio, metadata: SongMetadata):
        """Read Vorbis comments (FLAC, OGG)"""
        if not hasattr(audio, 'tags') or audio.tags is None:
            return

        tags = audio.tags

        metadata.title = tags.get('title', [''])[0]
        metadata.artist = tags.get('artist', [''])[0]
        metadata.album = tags.get('album', [''])[0]
        metadata.album_artist = tags.get('albumartist', [''])[0]
        metadata.genre = tags.get('genre', [''])[0]

        if 'date' in tags:
            try:
                metadata.year = int(tags['date'][0][:4])
            except (ValueError, IndexError):
                pass

        if 'tracknumber' in tags:
            try:
                metadata.track_number = int(tags['tracknumber'][0].split('/')[0])
            except (ValueError, IndexError):
                pass

        # Custom fields
        for key, frame_name in self.RADIO_FRAMES.items():
            if frame_name.lower() in tags:
                value = tags[frame_name.lower()][0]
                setattr(metadata, key, value)

    def _read_mp4_tags(self, audio, metadata: SongMetadata):
        """Read MP4/M4A tags"""
        if not hasattr(audio, 'tags') or audio.tags is None:
            return

        tags = audio.tags

        metadata.title = tags.get('\xa9nam', [''])[0] if '\xa9nam' in tags else ""
        metadata.artist = tags.get('\xa9ART', [''])[0] if '\xa9ART' in tags else ""
        metadata.album = tags.get('\xa9alb', [''])[0] if '\xa9alb' in tags else ""
        metadata.album_artist = tags.get('aART', [''])[0] if 'aART' in tags else ""
        metadata.genre = tags.get('\xa9gen', [''])[0] if '\xa9gen' in tags else ""

        if '\xa9day' in tags:
            try:
                metadata.year = int(str(tags['\xa9day'][0])[:4])
            except (ValueError, IndexError):
                pass

        if 'trkn' in tags:
            try:
                metadata.track_number = tags['trkn'][0][0]
            except (TypeError, IndexError):
                pass

    def _read_with_tinytag(self, file_path: Path, metadata: SongMetadata):
        """Read metadata using TinyTag (fallback)"""
        tag = self._tinytag.get(str(file_path))

        metadata.title = tag.title or ""
        metadata.artist = tag.artist or ""
        metadata.album = tag.album or ""
        metadata.album_artist = tag.albumartist or ""
        metadata.genre = tag.genre or ""
        metadata.year = tag.year
        metadata.track_number = tag.track
        metadata.duration_seconds = tag.duration or 0
        metadata.bitrate = tag.bitrate
        metadata.sample_rate = tag.samplerate
        metadata.channels = tag.channels

    def write_metadata(self, file_path: str, metadata: SongMetadata,
                       fields: Optional[List[str]] = None) -> bool:
        """
        Write metadata to an audio file.

        Args:
            file_path: Path to the audio file
            metadata: SongMetadata object with values to write
            fields: Optional list of field names to write (writes all if None)

        Returns:
            True if successful, False otherwise
        """
        if self._mutagen is None:
            logger.error("Mutagen not available - cannot write metadata")
            return False

        file_path = Path(file_path)
        if not file_path.exists():
            logger.error(f"File not found: {file_path}")
            return False

        try:
            suffix = file_path.suffix.lower()

            if suffix == '.mp3':
                return self._write_mp3_tags(file_path, metadata, fields)
            elif suffix == '.flac':
                return self._write_vorbis_tags(file_path, metadata, fields)
            elif suffix in ['.m4a', '.mp4', '.aac']:
                return self._write_mp4_tags(file_path, metadata, fields)
            else:
                logger.warning(f"Writing not supported for format: {suffix}")
                return False

        except Exception as e:
            logger.error(f"Error writing metadata to {file_path}: {e}")
            return False

    def _write_mp3_tags(self, file_path: Path, metadata: SongMetadata,
                        fields: Optional[List[str]] = None) -> bool:
        """Write ID3 tags to MP3 file"""
        from mutagen.mp3 import MP3
        from mutagen.id3 import ID3, TIT2, TPE1, TALB, TPE2, TCON, TDRC, TRCK, TXXX

        audio = MP3(str(file_path))

        # Add ID3 tag if it doesn't exist
        if audio.tags is None:
            audio.add_tags()

        tags = audio.tags

        def should_write(field_name):
            return fields is None or field_name in fields

        # Standard tags
        if should_write('title') and metadata.title:
            tags['TIT2'] = TIT2(encoding=3, text=metadata.title)
        if should_write('artist') and metadata.artist:
            tags['TPE1'] = TPE1(encoding=3, text=metadata.artist)
        if should_write('album') and metadata.album:
            tags['TALB'] = TALB(encoding=3, text=metadata.album)
        if should_write('album_artist') and metadata.album_artist:
            tags['TPE2'] = TPE2(encoding=3, text=metadata.album_artist)
        if should_write('genre') and metadata.genre:
            tags['TCON'] = TCON(encoding=3, text=metadata.genre)
        if should_write('year') and metadata.year:
            tags['TDRC'] = TDRC(encoding=3, text=str(metadata.year))
        if should_write('track_number') and metadata.track_number:
            tags['TRCK'] = TRCK(encoding=3, text=str(metadata.track_number))

        # Custom TXXX frames for radio metadata
        radio_fields = [
            ('category', str(metadata.category)),
            ('mood', str(metadata.mood)),
            ('tempo', str(metadata.tempo)),
            ('tempo_bpm', str(metadata.tempo_bpm) if metadata.tempo_bpm else ''),
            ('gender', str(metadata.gender)),
            ('energy', str(metadata.energy)),
            ('intro_seconds', str(metadata.intro_seconds)),
            ('outro_seconds', str(metadata.outro_seconds)),
            ('explicit', str(metadata.explicit).lower()),
        ]

        for field_name, value in radio_fields:
            if should_write(field_name) and value:
                frame_name = self.RADIO_FRAMES[field_name]
                # Remove existing frame
                tags.delall('TXXX:' + frame_name)
                # Add new frame
                tags.add(TXXX(encoding=3, desc=frame_name, text=value))

        audio.save()
        logger.info(f"Wrote metadata to {file_path}")
        return True

    def _write_vorbis_tags(self, file_path: Path, metadata: SongMetadata,
                           fields: Optional[List[str]] = None) -> bool:
        """Write Vorbis comments to FLAC/OGG"""
        from mutagen import File

        audio = File(str(file_path))
        if audio.tags is None:
            audio.add_tags()

        def should_write(field_name):
            return fields is None or field_name in fields

        if should_write('title') and metadata.title:
            audio.tags['title'] = metadata.title
        if should_write('artist') and metadata.artist:
            audio.tags['artist'] = metadata.artist
        if should_write('album') and metadata.album:
            audio.tags['album'] = metadata.album
        if should_write('genre') and metadata.genre:
            audio.tags['genre'] = metadata.genre
        if should_write('year') and metadata.year:
            audio.tags['date'] = str(metadata.year)

        # Custom fields
        for field_name, frame_name in self.RADIO_FRAMES.items():
            if should_write(field_name):
                value = getattr(metadata, field_name, None)
                if value is not None:
                    audio.tags[frame_name.lower()] = str(value)

        audio.save()
        return True

    def _write_mp4_tags(self, file_path: Path, metadata: SongMetadata,
                        fields: Optional[List[str]] = None) -> bool:
        """Write MP4/M4A tags"""
        from mutagen.mp4 import MP4

        audio = MP4(str(file_path))

        def should_write(field_name):
            return fields is None or field_name in fields

        if should_write('title') and metadata.title:
            audio.tags['\xa9nam'] = metadata.title
        if should_write('artist') and metadata.artist:
            audio.tags['\xa9ART'] = metadata.artist
        if should_write('album') and metadata.album:
            audio.tags['\xa9alb'] = metadata.album
        if should_write('genre') and metadata.genre:
            audio.tags['\xa9gen'] = metadata.genre
        if should_write('year') and metadata.year:
            audio.tags['\xa9day'] = str(metadata.year)

        audio.save()
        return True

    def _normalize_genre(self, genre: str) -> str:
        """Normalize genre to standard format"""
        if not genre:
            return ""

        genre_lower = genre.lower().strip()
        return self.GENRE_NORMALIZATION.get(genre_lower, genre.title())

    def update_from_analysis(self, metadata: SongMetadata,
                             analysis: 'AudioAnalysis') -> SongMetadata:
        """
        Update metadata with values from audio analysis.

        Args:
            metadata: Existing metadata
            analysis: AudioAnalysis results

        Returns:
            Updated metadata
        """
        # Only update if not already set
        if not metadata.tempo:
            metadata.tempo = analysis.tempo_category
        if not metadata.tempo_bpm:
            metadata.tempo_bpm = analysis.tempo
        if not metadata.mood:
            metadata.mood = analysis.suggested_mood
        if not metadata.genre and analysis.suggested_genre:
            metadata.genre = analysis.suggested_genre
        if not metadata.duration_seconds:
            metadata.duration_seconds = analysis.duration_seconds
        if not metadata.intro_seconds:
            metadata.intro_seconds = analysis.intro_seconds
        if not metadata.outro_seconds:
            metadata.outro_seconds = analysis.outro_seconds
        if analysis.instrumentalness > 0.7:
            metadata.is_instrumental = True
            metadata.gender = "Instrumental"

        # Set energy level
        if analysis.energy < 0.33:
            metadata.energy = "Low"
        elif analysis.energy < 0.66:
            metadata.energy = "Medium"
        else:
            metadata.energy = "High"

        return metadata

    def batch_read(self, file_paths: List[str],
                   progress_callback=None) -> Dict[str, SongMetadata]:
        """
        Read metadata from multiple files.

        Args:
            file_paths: List of file paths
            progress_callback: Optional callback(current, total, filename)

        Returns:
            Dictionary mapping file paths to metadata
        """
        results = {}
        total = len(file_paths)

        for i, file_path in enumerate(file_paths):
            if progress_callback:
                progress_callback(i + 1, total, file_path)

            metadata = self.read_metadata(file_path)
            if metadata:
                results[file_path] = metadata

        return results
