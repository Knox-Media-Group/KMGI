"""
Database Manager for KMGI Radio Automation

Handles database connections, sessions, and common operations.
"""

import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from contextlib import contextmanager

from sqlalchemy import create_engine, func, and_, or_
from sqlalchemy.orm import sessionmaker, Session

from .models import Base, Song, PlayLog, Category, Rule, AuditReport

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages database operations for the KMGI system"""

    def __init__(self, db_path: str = "data/kmgi.db"):
        """
        Initialize database connection.

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self.engine = create_engine(f'sqlite:///{self.db_path}', echo=False)
        self.SessionLocal = sessionmaker(bind=self.engine)

    def init_db(self):
        """Initialize database tables"""
        Base.metadata.create_all(self.engine)
        logger.info(f"Database initialized at {self.db_path}")

        # Create default categories if they don't exist
        with self.session_scope() as session:
            self._create_default_categories(session)

    def _create_default_categories(self, session: Session):
        """Create default rotation categories"""
        defaults = [
            ("Current", "CUR", "New releases in heavy rotation", "#FF6B6B", 100),
            ("Recurrent", "REC", "Recent hits moving out of current", "#4ECDC4", 80),
            ("Power Gold", "PWG", "All-time hits with high familiarity", "#FFE66D", 60),
            ("Gold", "GLD", "Classic hits", "#95E1D3", 40),
            ("Deep Cut", "DPC", "Album tracks and lesser-known songs", "#A8D8EA", 20),
        ]

        for name, code, desc, color, priority in defaults:
            existing = session.query(Category).filter_by(code=code).first()
            if not existing:
                category = Category(
                    name=name, code=code, description=desc,
                    color=color, priority=priority
                )
                session.add(category)

        session.commit()

    @contextmanager
    def session_scope(self):
        """Provide a transactional scope around operations"""
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    # Song operations
    def add_song(self, song_data: Dict[str, Any]) -> Optional[Song]:
        """Add or update a song in the database"""
        with self.session_scope() as session:
            # Check if song already exists by file path
            existing = session.query(Song).filter_by(
                file_path=song_data['file_path']
            ).first()

            if existing:
                # Update existing song
                for key, value in song_data.items():
                    if hasattr(existing, key) and key != 'id':
                        setattr(existing, key, value)
                existing.last_modified = datetime.utcnow()
                song = existing
            else:
                # Create new song
                song = Song(**song_data)
                session.add(song)

            session.flush()
            return song

    def get_song_by_id(self, song_id: int) -> Optional[Song]:
        """Get a song by its ID"""
        with self.session_scope() as session:
            return session.query(Song).filter_by(id=song_id).first()

    def get_song_by_path(self, file_path: str) -> Optional[Song]:
        """Get a song by its file path"""
        with self.session_scope() as session:
            return session.query(Song).filter_by(file_path=file_path).first()

    def search_songs(self, query: str, limit: int = 50) -> List[Song]:
        """Search songs by title or artist"""
        with self.session_scope() as session:
            search = f"%{query}%"
            return session.query(Song).filter(
                or_(
                    Song.title.ilike(search),
                    Song.artist.ilike(search)
                )
            ).limit(limit).all()

    def get_songs_by_category(self, category: str,
                               active_only: bool = True) -> List[Song]:
        """Get all songs in a category"""
        with self.session_scope() as session:
            query = session.query(Song).filter_by(category=category)
            if active_only:
                query = query.filter_by(is_active=True)
            return query.all()

    def get_songs_needing_analysis(self, limit: int = 100) -> List[Song]:
        """Get songs that haven't been analyzed or need re-analysis"""
        with self.session_scope() as session:
            return session.query(Song).filter(
                or_(
                    Song.last_analyzed.is_(None),
                    Song.analysis_confidence < 0.5
                )
            ).limit(limit).all()

    def get_eligible_songs(self, category: str = None,
                            min_rest_minutes: int = 180,
                            excluded_artists: List[str] = None,
                            excluded_song_ids: List[int] = None) -> List[Song]:
        """Get songs eligible for play based on rest time and filters"""
        cutoff = datetime.utcnow() - timedelta(minutes=min_rest_minutes)

        with self.session_scope() as session:
            query = session.query(Song).filter(
                Song.is_active == True,
                or_(
                    Song.last_played.is_(None),
                    Song.last_played < cutoff
                )
            )

            if category:
                query = query.filter(Song.category == category)

            if excluded_artists:
                query = query.filter(~Song.artist.in_(excluded_artists))

            if excluded_song_ids:
                query = query.filter(~Song.id.in_(excluded_song_ids))

            return query.all()

    def update_song_played(self, song_id: int, played_at: datetime = None):
        """Update song's last played time and increment play count"""
        with self.session_scope() as session:
            song = session.query(Song).filter_by(id=song_id).first()
            if song:
                song.last_played = played_at or datetime.utcnow()
                song.play_count += 1
                song.total_play_time_seconds += song.duration_seconds or 0

    def get_library_stats(self) -> Dict[str, Any]:
        """Get overall library statistics"""
        with self.session_scope() as session:
            total = session.query(func.count(Song.id)).scalar()
            active = session.query(func.count(Song.id)).filter_by(is_active=True).scalar()

            # Category breakdown
            categories = session.query(
                Song.category,
                func.count(Song.id)
            ).group_by(Song.category).all()

            # Genre breakdown
            genres = session.query(
                Song.genre,
                func.count(Song.id)
            ).group_by(Song.genre).all()

            # Gender breakdown
            genders = session.query(
                Song.gender,
                func.count(Song.id)
            ).group_by(Song.gender).all()

            return {
                'total_songs': total,
                'active_songs': active,
                'by_category': dict(categories),
                'by_genre': dict(genres),
                'by_gender': dict(genders),
            }

    # Play log operations
    def log_play(self, song_id: int, source: str = "rotation",
                 scheduled_at: datetime = None,
                 completed: bool = True) -> PlayLog:
        """Log a song play"""
        now = datetime.utcnow()

        with self.session_scope() as session:
            # Determine daypart
            hour = now.hour
            if 6 <= hour < 10:
                daypart = "Morning Drive"
            elif 10 <= hour < 15:
                daypart = "Midday"
            elif 15 <= hour < 19:
                daypart = "Afternoon Drive"
            elif 19 <= hour < 24:
                daypart = "Evening"
            else:
                daypart = "Overnight"

            log = PlayLog(
                song_id=song_id,
                played_at=now,
                scheduled_at=scheduled_at,
                source=source,
                daypart=daypart,
                hour=hour,
                day_of_week=now.weekday(),
                completed=completed
            )
            session.add(log)

            # Update song's last played
            song = session.query(Song).filter_by(id=song_id).first()
            if song:
                song.last_played = now
                song.play_count += 1

            session.flush()
            return log

    def get_recent_plays(self, hours: int = 24) -> List[PlayLog]:
        """Get plays from the last N hours"""
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        with self.session_scope() as session:
            return session.query(PlayLog).filter(
                PlayLog.played_at >= cutoff
            ).order_by(PlayLog.played_at.desc()).all()

    def get_play_counts_by_hour(self, start_date: datetime,
                                 end_date: datetime) -> Dict[int, int]:
        """Get play counts grouped by hour for a date range"""
        with self.session_scope() as session:
            results = session.query(
                PlayLog.hour,
                func.count(PlayLog.id)
            ).filter(
                PlayLog.played_at >= start_date,
                PlayLog.played_at <= end_date
            ).group_by(PlayLog.hour).all()

            return dict(results)

    def get_artist_play_counts(self, start_date: datetime,
                                end_date: datetime,
                                limit: int = 20) -> List[tuple]:
        """Get top artists by play count in date range"""
        with self.session_scope() as session:
            return session.query(
                Song.artist,
                func.count(PlayLog.id).label('plays')
            ).join(PlayLog).filter(
                PlayLog.played_at >= start_date,
                PlayLog.played_at <= end_date
            ).group_by(Song.artist).order_by(
                func.count(PlayLog.id).desc()
            ).limit(limit).all()

    # Rule operations
    def get_active_rules(self, rule_type: str = None) -> List[Rule]:
        """Get active rules, optionally filtered by type"""
        with self.session_scope() as session:
            query = session.query(Rule).filter_by(is_active=True)
            if rule_type:
                query = query.filter_by(rule_type=rule_type)
            return query.order_by(Rule.priority.desc()).all()

    def add_rule(self, rule_data: Dict[str, Any]) -> Rule:
        """Add a new rule"""
        with self.session_scope() as session:
            rule = Rule(**rule_data)
            session.add(rule)
            session.flush()
            return rule

    # Audit operations
    def save_audit_report(self, report_data: Dict[str, Any]) -> AuditReport:
        """Save an audit report"""
        with self.session_scope() as session:
            report = AuditReport(**report_data)
            session.add(report)
            session.flush()
            return report

    def get_recent_audits(self, limit: int = 10) -> List[AuditReport]:
        """Get recent audit reports"""
        with self.session_scope() as session:
            return session.query(AuditReport).order_by(
                AuditReport.generated_at.desc()
            ).limit(limit).all()
