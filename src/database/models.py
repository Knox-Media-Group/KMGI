"""
Database Models for KMGI Radio Automation

SQLAlchemy models for storing song data, play logs, and rules.
"""

from datetime import datetime
from typing import Optional, Dict, Any
import json

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    Text, ForeignKey, Index, JSON
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class Song(Base):
    """Represents a song in the music library"""
    __tablename__ = 'songs'

    id = Column(Integer, primary_key=True)

    # File information
    file_path = Column(String(500), unique=True, nullable=False)
    file_format = Column(String(10))
    file_size_bytes = Column(Integer)

    # Basic metadata
    title = Column(String(255), nullable=False, index=True)
    artist = Column(String(255), nullable=False, index=True)
    album = Column(String(255))
    album_artist = Column(String(255))
    year = Column(Integer, index=True)
    track_number = Column(Integer)
    genre = Column(String(100), index=True)

    # Radio categorization
    category = Column(String(50), index=True)  # Current, Recurrent, Gold, etc.
    mood = Column(String(50), index=True)
    tempo = Column(String(20), index=True)  # Slow, Medium, Fast
    tempo_bpm = Column(Float)
    gender = Column(String(20), index=True)  # Male, Female, Group, etc.
    energy = Column(String(20))  # Low, Medium, High

    # Timing information
    duration_seconds = Column(Float)
    intro_seconds = Column(Float, default=0.0)
    outro_seconds = Column(Float, default=0.0)
    hook_start = Column(Float)
    hook_end = Column(Float)

    # Technical info
    bitrate = Column(Integer)
    sample_rate = Column(Integer)
    channels = Column(Integer)

    # Rotation info
    rotation_weight = Column(Float, default=1.0)  # Weight for random selection
    min_rest_minutes = Column(Integer)  # Minimum time before repeat
    max_plays_per_day = Column(Integer)  # Maximum daily plays

    # Content flags
    explicit = Column(Boolean, default=False)
    has_intro = Column(Boolean, default=False)
    has_outro = Column(Boolean, default=False)
    is_instrumental = Column(Boolean, default=False)
    is_remix = Column(Boolean, default=False)
    is_live = Column(Boolean, default=False)
    is_acoustic = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)  # Can be scheduled

    # Play statistics
    play_count = Column(Integer, default=0)
    last_played = Column(DateTime)
    total_play_time_seconds = Column(Float, default=0.0)

    # Library management
    date_added = Column(DateTime, default=datetime.utcnow)
    last_modified = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_analyzed = Column(DateTime)
    last_synced_opx = Column(DateTime)
    rating = Column(Integer)  # 1-5

    # Analysis confidence
    analysis_confidence = Column(Float, default=0.0)

    # Custom fields (JSON)
    custom_data = Column(JSON, default=dict)

    # Relationships
    play_logs = relationship("PlayLog", back_populates="song", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index('idx_song_search', 'title', 'artist'),
        Index('idx_song_rotation', 'category', 'is_active', 'last_played'),
    )

    def __repr__(self):
        return f"<Song(id={self.id}, artist='{self.artist}', title='{self.title}')>"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'file_path': self.file_path,
            'title': self.title,
            'artist': self.artist,
            'album': self.album,
            'year': self.year,
            'genre': self.genre,
            'category': self.category,
            'mood': self.mood,
            'tempo': self.tempo,
            'tempo_bpm': self.tempo_bpm,
            'gender': self.gender,
            'energy': self.energy,
            'duration_seconds': self.duration_seconds,
            'intro_seconds': self.intro_seconds,
            'outro_seconds': self.outro_seconds,
            'explicit': self.explicit,
            'is_active': self.is_active,
            'play_count': self.play_count,
            'last_played': self.last_played.isoformat() if self.last_played else None,
            'date_added': self.date_added.isoformat() if self.date_added else None,
            'rating': self.rating,
        }


class PlayLog(Base):
    """Log of song plays for rotation tracking"""
    __tablename__ = 'play_logs'

    id = Column(Integer, primary_key=True)
    song_id = Column(Integer, ForeignKey('songs.id'), nullable=False)
    played_at = Column(DateTime, default=datetime.utcnow, index=True)
    scheduled_at = Column(DateTime)  # When it was scheduled (may differ from play)
    source = Column(String(50))  # 'rotation', 'manual', 'request', etc.
    daypart = Column(String(50))  # Morning, Midday, Afternoon, Evening, Overnight
    hour = Column(Integer)  # Hour of day (0-23)
    day_of_week = Column(Integer)  # 0=Monday, 6=Sunday
    duration_played = Column(Float)  # Actual play duration (might be cut short)
    completed = Column(Boolean, default=True)  # Was it played completely?
    skipped = Column(Boolean, default=False)
    skip_reason = Column(String(255))

    # Relationship
    song = relationship("Song", back_populates="play_logs")

    __table_args__ = (
        Index('idx_playlog_time', 'played_at', 'hour'),
        Index('idx_playlog_song_time', 'song_id', 'played_at'),
    )

    def __repr__(self):
        return f"<PlayLog(id={self.id}, song_id={self.song_id}, played_at={self.played_at})>"


class Category(Base):
    """Rotation category definition"""
    __tablename__ = 'categories'

    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)
    code = Column(String(10), unique=True, nullable=False)
    description = Column(Text)
    color = Column(String(7))  # Hex color code
    priority = Column(Integer, default=0)  # Higher = more important
    max_age_days = Column(Integer)  # Max age of songs in this category
    min_rest_minutes = Column(Integer, default=180)  # Default rest for songs
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Category(name='{self.name}', code='{self.code}')>"


class Rule(Base):
    """Rotation rules for scheduling"""
    __tablename__ = 'rules'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    rule_type = Column(String(50), nullable=False)  # 'hourly', 'separation', 'limit', etc.
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)  # Higher = evaluated first

    # Rule conditions (JSON)
    conditions = Column(JSON, default=dict)
    # Example: {"hours": [6,7,8,9], "categories": ["Current", "Power Gold"]}

    # Rule actions (JSON)
    actions = Column(JSON, default=dict)
    # Example: {"percentage": 40, "max_per_hour": 3}

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Rule(name='{self.name}', type='{self.rule_type}')>"

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'rule_type': self.rule_type,
            'is_active': self.is_active,
            'priority': self.priority,
            'conditions': self.conditions,
            'actions': self.actions,
        }


class AuditReport(Base):
    """Weekly rotation audit reports"""
    __tablename__ = 'audit_reports'

    id = Column(Integer, primary_key=True)
    report_type = Column(String(50), nullable=False)  # 'weekly', 'daily', 'custom'
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)

    # Summary statistics (JSON)
    summary = Column(JSON, default=dict)
    # Example: {"total_plays": 1000, "unique_songs": 200, ...}

    # Detailed data (JSON)
    data = Column(JSON, default=dict)

    # Rule violations found (JSON list)
    violations = Column(JSON, default=list)

    # Recommendations (JSON list)
    recommendations = Column(JSON, default=list)

    def __repr__(self):
        return f"<AuditReport(type='{self.report_type}', start={self.start_date})>"
