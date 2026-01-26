"""
Audio Analysis Module for KMGI Radio Automation

Analyzes audio files to detect:
- Tempo (BPM)
- Energy level
- Mood characteristics
- Genre classification
"""

import os
import logging
from pathlib import Path
from typing import Dict, Optional, Any
from dataclasses import dataclass, asdict

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class AudioAnalysis:
    """Results of audio analysis"""
    tempo: float
    tempo_category: str  # Slow, Medium, Fast
    energy: float  # 0.0 - 1.0
    danceability: float  # 0.0 - 1.0
    valence: float  # 0.0 - 1.0 (musical positivity)
    acousticness: float  # 0.0 - 1.0
    instrumentalness: float  # 0.0 - 1.0
    duration_seconds: float
    intro_seconds: float  # Estimated intro length
    outro_seconds: float  # Estimated outro length
    suggested_mood: str
    suggested_genre: Optional[str] = None
    confidence: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class AudioAnalyzer:
    """Analyzes audio files for radio automation categorization"""

    # Tempo category thresholds
    TEMPO_SLOW_MAX = 80
    TEMPO_MEDIUM_MAX = 120

    # Mood mapping based on valence and energy
    MOOD_MATRIX = {
        (True, True): "Happy",      # High valence, high energy
        (True, False): "Calm",       # High valence, low energy
        (False, True): "Angry",      # Low valence, high energy
        (False, False): "Sad",       # Low valence, low energy
    }

    def __init__(self, config: Optional[Dict] = None):
        """
        Initialize the audio analyzer.

        Args:
            config: Optional configuration dictionary
        """
        self.config = config or {}
        self._librosa = None
        self._load_libraries()

    def _load_libraries(self):
        """Lazy load heavy libraries"""
        try:
            import librosa
            self._librosa = librosa
            logger.info("Librosa loaded successfully")
        except ImportError:
            logger.warning("Librosa not available - audio analysis will be limited")

    def analyze_file(self, file_path: str) -> Optional[AudioAnalysis]:
        """
        Analyze an audio file and return detailed analysis.

        Args:
            file_path: Path to the audio file

        Returns:
            AudioAnalysis object or None if analysis fails
        """
        file_path = Path(file_path)

        if not file_path.exists():
            logger.error(f"File not found: {file_path}")
            return None

        if not self._is_supported_format(file_path):
            logger.error(f"Unsupported format: {file_path.suffix}")
            return None

        try:
            return self._perform_analysis(str(file_path))
        except Exception as e:
            logger.error(f"Error analyzing {file_path}: {e}")
            return None

    def _is_supported_format(self, file_path: Path) -> bool:
        """Check if file format is supported"""
        supported = {'.mp3', '.wav', '.flac', '.m4a', '.ogg', '.wma'}
        return file_path.suffix.lower() in supported

    def _perform_analysis(self, file_path: str) -> AudioAnalysis:
        """Perform the actual audio analysis"""
        if self._librosa is None:
            return self._basic_analysis(file_path)

        librosa = self._librosa

        # Load audio file
        logger.info(f"Loading audio: {file_path}")
        y, sr = librosa.load(file_path, sr=22050, mono=True)
        duration = librosa.get_duration(y=y, sr=sr)

        # Tempo detection
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        tempo = float(tempo) if isinstance(tempo, np.ndarray) else tempo

        # Spectral features
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]

        # RMS energy
        rms = librosa.feature.rms(y=y)[0]
        energy = float(np.mean(rms))
        energy_normalized = min(1.0, energy * 10)  # Normalize to 0-1

        # Zero crossing rate (indicator of percussiveness)
        zcr = librosa.feature.zero_crossing_rate(y)[0]

        # Onset strength for danceability estimate
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        danceability = self._calculate_danceability(tempo, onset_env)

        # Harmonic and percussive components
        y_harmonic, y_percussive = librosa.effects.hpss(y)
        harmonic_ratio = np.sum(np.abs(y_harmonic)) / (np.sum(np.abs(y)) + 1e-6)

        # Estimate acousticness from spectral features
        acousticness = self._estimate_acousticness(spectral_centroids, harmonic_ratio)

        # Estimate instrumentalness
        instrumentalness = self._estimate_instrumentalness(y, sr)

        # Valence estimation (simplified)
        valence = self._estimate_valence(spectral_centroids, tempo, harmonic_ratio)

        # Detect intro/outro
        intro_seconds = self._detect_intro(y, sr, onset_env)
        outro_seconds = self._detect_outro(y, sr, onset_env)

        # Categorize tempo
        tempo_category = self._categorize_tempo(tempo)

        # Determine mood
        suggested_mood = self._determine_mood(valence, energy_normalized, tempo)

        # Attempt genre classification
        suggested_genre = self._classify_genre(
            tempo, energy_normalized, acousticness,
            danceability, spectral_centroids
        )

        return AudioAnalysis(
            tempo=round(tempo, 1),
            tempo_category=tempo_category,
            energy=round(energy_normalized, 3),
            danceability=round(danceability, 3),
            valence=round(valence, 3),
            acousticness=round(acousticness, 3),
            instrumentalness=round(instrumentalness, 3),
            duration_seconds=round(duration, 2),
            intro_seconds=round(intro_seconds, 2),
            outro_seconds=round(outro_seconds, 2),
            suggested_mood=suggested_mood,
            suggested_genre=suggested_genre,
            confidence=0.75  # Base confidence level
        )

    def _basic_analysis(self, file_path: str) -> AudioAnalysis:
        """Fallback basic analysis when librosa is not available"""
        from tinytag import TinyTag

        try:
            tag = TinyTag.get(file_path)
            duration = tag.duration or 0
        except Exception:
            duration = 0

        return AudioAnalysis(
            tempo=0.0,
            tempo_category="Unknown",
            energy=0.5,
            danceability=0.5,
            valence=0.5,
            acousticness=0.5,
            instrumentalness=0.0,
            duration_seconds=duration,
            intro_seconds=0.0,
            outro_seconds=0.0,
            suggested_mood="Unknown",
            suggested_genre=None,
            confidence=0.1
        )

    def _calculate_danceability(self, tempo: float, onset_env: np.ndarray) -> float:
        """Calculate danceability score"""
        # Ideal dance tempo range
        tempo_score = 1.0 - abs(tempo - 120) / 120
        tempo_score = max(0, min(1, tempo_score))

        # Regularity of beats
        onset_std = np.std(onset_env)
        onset_mean = np.mean(onset_env)
        regularity = 1.0 - (onset_std / (onset_mean + 1e-6))
        regularity = max(0, min(1, regularity))

        return (tempo_score * 0.6 + regularity * 0.4)

    def _estimate_acousticness(self, spectral_centroids: np.ndarray,
                                harmonic_ratio: float) -> float:
        """Estimate how acoustic (vs electronic) the track is"""
        # Lower spectral centroid often indicates acoustic instruments
        centroid_mean = np.mean(spectral_centroids)
        centroid_score = 1.0 - min(1.0, centroid_mean / 5000)

        # Higher harmonic content often indicates acoustic
        return (centroid_score * 0.5 + harmonic_ratio * 0.5)

    def _estimate_instrumentalness(self, y: np.ndarray, sr: int) -> float:
        """Estimate likelihood of track being instrumental"""
        librosa = self._librosa
        if librosa is None:
            return 0.0

        # Use spectral flatness as a proxy
        flatness = librosa.feature.spectral_flatness(y=y)[0]
        mean_flatness = np.mean(flatness)

        # Very flat spectrum often indicates noise/instruments without vocals
        # This is a rough heuristic
        return min(1.0, mean_flatness * 5)

    def _estimate_valence(self, spectral_centroids: np.ndarray,
                          tempo: float, harmonic_ratio: float) -> float:
        """Estimate musical positiveness (valence)"""
        # Higher tempo generally more positive
        tempo_contribution = min(1.0, tempo / 140)

        # Brighter sounds (higher spectral centroid) often more positive
        centroid_mean = np.mean(spectral_centroids)
        brightness = min(1.0, centroid_mean / 3500)

        # Major keys tend to be more harmonic (simplified assumption)
        return (tempo_contribution * 0.4 + brightness * 0.4 + harmonic_ratio * 0.2)

    def _detect_intro(self, y: np.ndarray, sr: int,
                      onset_env: np.ndarray) -> float:
        """Detect intro length (time before main content starts)"""
        # Find first significant onset
        threshold = np.max(onset_env) * 0.3
        for i, val in enumerate(onset_env):
            if val > threshold:
                frames_to_time = len(y) / sr / len(onset_env)
                return i * frames_to_time
        return 0.0

    def _detect_outro(self, y: np.ndarray, sr: int,
                      onset_env: np.ndarray) -> float:
        """Detect outro length (fade out time)"""
        # Find last significant onset
        threshold = np.max(onset_env) * 0.2
        reversed_env = onset_env[::-1]
        for i, val in enumerate(reversed_env):
            if val > threshold:
                frames_to_time = len(y) / sr / len(onset_env)
                return i * frames_to_time
        return 0.0

    def _categorize_tempo(self, tempo: float) -> str:
        """Categorize tempo into Slow, Medium, or Fast"""
        if tempo < self.TEMPO_SLOW_MAX:
            return "Slow"
        elif tempo < self.TEMPO_MEDIUM_MAX:
            return "Medium"
        else:
            return "Fast"

    def _determine_mood(self, valence: float, energy: float, tempo: float) -> str:
        """Determine mood based on audio characteristics"""
        high_valence = valence > 0.5
        high_energy = energy > 0.5

        base_mood = self.MOOD_MATRIX[(high_valence, high_energy)]

        # Refine based on more nuanced thresholds
        if high_valence and high_energy and tempo > 120:
            return "Energetic"
        if high_valence and not high_energy and valence > 0.7:
            return "Peaceful"
        if not high_valence and not high_energy and valence < 0.3:
            return "Melancholic"
        if high_valence and energy > 0.3 and energy < 0.6:
            return "Romantic"
        if high_energy and valence > 0.6:
            return "Uplifting"

        return base_mood

    def _classify_genre(self, tempo: float, energy: float, acousticness: float,
                        danceability: float, spectral_centroids: np.ndarray) -> Optional[str]:
        """
        Attempt to classify genre based on audio features.
        This is a simplified heuristic-based approach.
        """
        centroid_mean = np.mean(spectral_centroids)

        # Electronic music: high danceability, low acousticness
        if danceability > 0.7 and acousticness < 0.3 and tempo > 115:
            return "Electronic"

        # Hip-Hop: specific tempo range, lower acousticness
        if 80 <= tempo <= 115 and acousticness < 0.4:
            return "Hip-Hop"

        # Rock: high energy, medium-high tempo
        if energy > 0.6 and centroid_mean > 2500 and tempo > 100:
            return "Rock"

        # R&B: medium tempo, moderate energy
        if 70 <= tempo <= 110 and 0.3 <= energy <= 0.6:
            return "R&B"

        # Country: high acousticness, moderate tempo
        if acousticness > 0.6 and 90 <= tempo <= 140:
            return "Country"

        # Jazz: high acousticness, variable tempo
        if acousticness > 0.7 and energy < 0.5:
            return "Jazz"

        # Pop: default for commercial-sounding tracks
        if 100 <= tempo <= 130 and danceability > 0.5:
            return "Pop"

        return None

    def batch_analyze(self, file_paths: list[str],
                      progress_callback=None) -> Dict[str, AudioAnalysis]:
        """
        Analyze multiple files with optional progress callback.

        Args:
            file_paths: List of file paths to analyze
            progress_callback: Optional callback(current, total, filename)

        Returns:
            Dictionary mapping file paths to their analysis results
        """
        results = {}
        total = len(file_paths)

        for i, file_path in enumerate(file_paths):
            if progress_callback:
                progress_callback(i + 1, total, file_path)

            result = self.analyze_file(file_path)
            if result:
                results[file_path] = result

        return results
