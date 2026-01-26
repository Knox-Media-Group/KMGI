"""
Rotation Auditing Module for KMGI Radio Automation

Generates weekly rotation reports and identifies rule violations.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path
from collections import defaultdict

from ..database.db import DatabaseManager
from ..database.models import Song, PlayLog, AuditReport
from ..rules.rules_engine import RulesEngine

logger = logging.getLogger(__name__)


class RotationAuditor:
    """
    Audits rotation patterns and generates reports.

    Tracks:
    - Song play frequency and distribution
    - Category rotation compliance
    - Gender balance
    - Tempo flow patterns
    - Rule violations
    - Artist exposure
    """

    def __init__(self, config: Dict = None, db: DatabaseManager = None,
                 rules_engine: RulesEngine = None):
        """
        Initialize the auditor.

        Args:
            config: Configuration dictionary
            db: Database manager
            rules_engine: Rules engine for violation checking
        """
        self.config = config or {}
        self.db = db
        self.rules_engine = rules_engine

        audit_config = self.config.get('audit', {})
        self.reports_folder = Path(audit_config.get('reports_folder', 'reports'))
        self.reports_folder.mkdir(parents=True, exist_ok=True)

    def generate_weekly_report(self, end_date: datetime = None) -> Dict[str, Any]:
        """
        Generate a comprehensive weekly rotation report.

        Args:
            end_date: End date for the report (defaults to now)

        Returns:
            Report dictionary with all metrics
        """
        end_date = end_date or datetime.utcnow()
        start_date = end_date - timedelta(days=7)

        report = {
            'report_type': 'weekly',
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'generated_at': datetime.utcnow().isoformat(),
            'summary': {},
            'category_breakdown': {},
            'gender_breakdown': {},
            'tempo_breakdown': {},
            'genre_breakdown': {},
            'hourly_distribution': {},
            'top_songs': [],
            'top_artists': [],
            'underplayed_songs': [],
            'overplayed_songs': [],
            'rule_violations': [],
            'recommendations': []
        }

        if not self.db:
            logger.error("Database not configured for auditing")
            return report

        with self.db.session_scope() as session:
            # Get all plays in the period
            plays = session.query(PlayLog).filter(
                PlayLog.played_at >= start_date,
                PlayLog.played_at <= end_date
            ).all()

            # Get all active songs
            all_songs = session.query(Song).filter_by(is_active=True).all()

            # Calculate summary statistics
            report['summary'] = self._calculate_summary(plays, all_songs)

            # Category breakdown
            report['category_breakdown'] = self._analyze_categories(plays, session)

            # Gender breakdown
            report['gender_breakdown'] = self._analyze_gender(plays, session)

            # Tempo breakdown
            report['tempo_breakdown'] = self._analyze_tempo(plays, session)

            # Genre breakdown
            report['genre_breakdown'] = self._analyze_genre(plays, session)

            # Hourly distribution
            report['hourly_distribution'] = self._analyze_hourly(plays)

            # Top songs and artists
            report['top_songs'] = self._get_top_songs(plays, session, limit=20)
            report['top_artists'] = self._get_top_artists(plays, session, limit=20)

            # Underplayed and overplayed songs
            report['underplayed_songs'] = self._find_underplayed(plays, all_songs, session)
            report['overplayed_songs'] = self._find_overplayed(plays, session)

            # Rule violations
            report['rule_violations'] = self._find_violations(plays, session)

            # Generate recommendations
            report['recommendations'] = self._generate_recommendations(report)

        # Save report to database
        if self.db:
            self._save_report(report)

        # Export to file
        self._export_report(report)

        return report

    def _calculate_summary(self, plays: List[PlayLog], all_songs: List[Song]) -> Dict[str, Any]:
        """Calculate summary statistics"""
        unique_songs = set()
        unique_artists = set()
        total_duration = 0

        for play in plays:
            if play.song:
                unique_songs.add(play.song_id)
                unique_artists.add(play.song.artist)
                total_duration += play.song.duration_seconds or 0

        return {
            'total_plays': len(plays),
            'unique_songs_played': len(unique_songs),
            'unique_artists_played': len(unique_artists),
            'total_songs_in_library': len(all_songs),
            'library_coverage_percent': round(len(unique_songs) / len(all_songs) * 100, 1) if all_songs else 0,
            'total_air_time_hours': round(total_duration / 3600, 1),
            'average_plays_per_song': round(len(plays) / len(unique_songs), 1) if unique_songs else 0,
            'average_plays_per_day': round(len(plays) / 7, 1),
            'completed_plays': sum(1 for p in plays if p.completed),
            'skipped_plays': sum(1 for p in plays if p.skipped),
        }

    def _analyze_categories(self, plays: List[PlayLog], session) -> Dict[str, Any]:
        """Analyze category distribution"""
        category_counts = defaultdict(int)
        category_songs = defaultdict(set)

        for play in plays:
            if play.song and play.song.category:
                category_counts[play.song.category] += 1
                category_songs[play.song.category].add(play.song_id)

        total = len(plays) or 1
        result = {}

        for category, count in category_counts.items():
            result[category] = {
                'plays': count,
                'percentage': round(count / total * 100, 1),
                'unique_songs': len(category_songs[category])
            }

        return result

    def _analyze_gender(self, plays: List[PlayLog], session) -> Dict[str, Any]:
        """Analyze gender distribution"""
        gender_counts = defaultdict(int)

        for play in plays:
            if play.song:
                gender = play.song.gender or 'Unknown'
                gender_counts[gender] += 1

        total = len(plays) or 1
        return {
            gender: {
                'plays': count,
                'percentage': round(count / total * 100, 1)
            }
            for gender, count in gender_counts.items()
        }

    def _analyze_tempo(self, plays: List[PlayLog], session) -> Dict[str, Any]:
        """Analyze tempo distribution"""
        tempo_counts = defaultdict(int)

        for play in plays:
            if play.song:
                tempo = play.song.tempo or 'Unknown'
                tempo_counts[tempo] += 1

        total = len(plays) or 1
        return {
            tempo: {
                'plays': count,
                'percentage': round(count / total * 100, 1)
            }
            for tempo, count in tempo_counts.items()
        }

    def _analyze_genre(self, plays: List[PlayLog], session) -> Dict[str, Any]:
        """Analyze genre distribution"""
        genre_counts = defaultdict(int)

        for play in plays:
            if play.song:
                genre = play.song.genre or 'Unknown'
                genre_counts[genre] += 1

        total = len(plays) or 1
        result = {}

        # Sort by count descending
        for genre, count in sorted(genre_counts.items(), key=lambda x: x[1], reverse=True):
            result[genre] = {
                'plays': count,
                'percentage': round(count / total * 100, 1)
            }

        return result

    def _analyze_hourly(self, plays: List[PlayLog]) -> Dict[int, Dict[str, Any]]:
        """Analyze hourly distribution"""
        hourly = {h: {'plays': 0, 'categories': defaultdict(int)} for h in range(24)}

        for play in plays:
            hour = play.hour or play.played_at.hour
            hourly[hour]['plays'] += 1
            if play.song and play.song.category:
                hourly[hour]['categories'][play.song.category] += 1

        # Convert defaultdicts to regular dicts
        for hour in hourly:
            hourly[hour]['categories'] = dict(hourly[hour]['categories'])

        return hourly

    def _get_top_songs(self, plays: List[PlayLog], session,
                        limit: int = 20) -> List[Dict[str, Any]]:
        """Get top played songs"""
        song_counts = defaultdict(int)

        for play in plays:
            if play.song:
                song_counts[play.song_id] += 1

        top_songs = []
        for song_id, count in sorted(song_counts.items(), key=lambda x: x[1], reverse=True)[:limit]:
            song = session.query(Song).filter_by(id=song_id).first()
            if song:
                top_songs.append({
                    'rank': len(top_songs) + 1,
                    'title': song.title,
                    'artist': song.artist,
                    'category': song.category,
                    'plays': count,
                    'song_id': song_id
                })

        return top_songs

    def _get_top_artists(self, plays: List[PlayLog], session,
                          limit: int = 20) -> List[Dict[str, Any]]:
        """Get top played artists"""
        artist_counts = defaultdict(int)
        artist_songs = defaultdict(set)

        for play in plays:
            if play.song:
                artist_counts[play.song.artist] += 1
                artist_songs[play.song.artist].add(play.song_id)

        top_artists = []
        for artist, count in sorted(artist_counts.items(), key=lambda x: x[1], reverse=True)[:limit]:
            top_artists.append({
                'rank': len(top_artists) + 1,
                'artist': artist,
                'plays': count,
                'unique_songs': len(artist_songs[artist])
            })

        return top_artists

    def _find_underplayed(self, plays: List[PlayLog], all_songs: List[Song],
                           session) -> List[Dict[str, Any]]:
        """Find songs that haven't been played enough"""
        played_ids = {p.song_id for p in plays}
        underplayed = []

        for song in all_songs:
            if song.category in ['Current', 'Power Gold']:  # High rotation categories
                play_count = sum(1 for p in plays if p.song_id == song.id)

                # Current songs should play at least once per day
                expected = 7 if song.category == 'Current' else 3

                if play_count < expected:
                    underplayed.append({
                        'title': song.title,
                        'artist': song.artist,
                        'category': song.category,
                        'actual_plays': play_count,
                        'expected_plays': expected,
                        'song_id': song.id
                    })

        return sorted(underplayed, key=lambda x: x['actual_plays'])[:20]

    def _find_overplayed(self, plays: List[PlayLog], session,
                          limit: int = 20) -> List[Dict[str, Any]]:
        """Find songs that have been played too frequently"""
        song_plays = defaultdict(list)

        for play in plays:
            if play.song:
                song_plays[play.song_id].append(play)

        overplayed = []
        settings = self.rules_engine.rules.get('settings', {}) if self.rules_engine else {}
        min_separation = settings.get('song_separation', 180)  # minutes

        for song_id, song_plays_list in song_plays.items():
            violations = 0
            song = session.query(Song).filter_by(id=song_id).first()

            # Check for separation violations
            sorted_plays = sorted(song_plays_list, key=lambda x: x.played_at)
            for i in range(1, len(sorted_plays)):
                gap = (sorted_plays[i].played_at - sorted_plays[i-1].played_at).total_seconds() / 60
                if gap < min_separation:
                    violations += 1

            if violations > 0 and song:
                overplayed.append({
                    'title': song.title,
                    'artist': song.artist,
                    'category': song.category,
                    'total_plays': len(song_plays_list),
                    'separation_violations': violations,
                    'song_id': song_id
                })

        return sorted(overplayed, key=lambda x: x['separation_violations'], reverse=True)[:limit]

    def _find_violations(self, plays: List[PlayLog], session) -> List[Dict[str, Any]]:
        """Find all rule violations in the audit period"""
        violations = []

        if not self.rules_engine:
            return violations

        # Analyze consecutive plays for various violations
        sorted_plays = sorted(plays, key=lambda x: x.played_at)

        for i, play in enumerate(sorted_plays[1:], 1):
            if not play.song:
                continue

            # Build context from previous plays
            prev_plays = sorted_plays[max(0, i-10):i]
            context = {
                'recent_plays': prev_plays,
                'recent_songs': [p.song for p in prev_plays if p.song],
                'hour': play.hour
            }

            _, play_violations = self.rules_engine.can_play_song(play.song, context)

            for v in play_violations:
                if v.severity in ['error', 'critical']:
                    violations.append({
                        'timestamp': play.played_at.isoformat(),
                        'song': play.song.title,
                        'artist': play.song.artist,
                        'rule_name': v.rule_name,
                        'rule_type': v.rule_type,
                        'severity': v.severity,
                        'message': v.message
                    })

        return violations[:100]  # Limit to 100 violations

    def _generate_recommendations(self, report: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on the report"""
        recommendations = []
        summary = report['summary']

        # Library coverage
        coverage = summary.get('library_coverage_percent', 0)
        if coverage < 50:
            recommendations.append(
                f"Library coverage is low ({coverage}%). Consider increasing rotation variety."
            )

        # Underplayed songs
        if len(report['underplayed_songs']) > 10:
            recommendations.append(
                f"{len(report['underplayed_songs'])} songs are underplayed. "
                "Review rotation weights or song availability."
            )

        # Category balance
        categories = report['category_breakdown']
        if 'Current' in categories:
            current_pct = categories['Current'].get('percentage', 0)
            if current_pct < 25:
                recommendations.append(
                    f"Current music is only {current_pct}% of rotation. "
                    "Consider increasing current music plays."
                )
            elif current_pct > 50:
                recommendations.append(
                    f"Current music is {current_pct}% of rotation. "
                    "Consider adding more variety from other categories."
                )

        # Gender balance
        genders = report['gender_breakdown']
        for gender, data in genders.items():
            pct = data.get('percentage', 0)
            if pct > 60:
                recommendations.append(
                    f"{gender} artists are {pct}% of rotation. "
                    "Consider improving gender balance."
                )

        # Rule violations
        violations = report['rule_violations']
        if len(violations) > 20:
            recommendations.append(
                f"Found {len(violations)} rule violations this week. "
                "Review scheduling rules and enforcement."
            )

        # Skipped plays
        if summary.get('skipped_plays', 0) > summary.get('total_plays', 1) * 0.05:
            skip_pct = summary['skipped_plays'] / summary['total_plays'] * 100
            recommendations.append(
                f"{skip_pct:.1f}% of scheduled plays were skipped. "
                "Investigate skip reasons."
            )

        return recommendations

    def _save_report(self, report: Dict[str, Any]):
        """Save report to database"""
        if not self.db:
            return

        audit_data = {
            'report_type': report['report_type'],
            'start_date': datetime.fromisoformat(report['start_date']),
            'end_date': datetime.fromisoformat(report['end_date']),
            'summary': report['summary'],
            'data': {
                'category_breakdown': report['category_breakdown'],
                'gender_breakdown': report['gender_breakdown'],
                'tempo_breakdown': report['tempo_breakdown'],
                'hourly_distribution': report['hourly_distribution'],
                'top_songs': report['top_songs'],
                'top_artists': report['top_artists'],
            },
            'violations': report['rule_violations'],
            'recommendations': report['recommendations'],
        }

        self.db.save_audit_report(audit_data)
        logger.info("Saved audit report to database")

    def _export_report(self, report: Dict[str, Any]):
        """Export report to file"""
        import json

        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f"rotation_report_{timestamp}.json"
        filepath = self.reports_folder / filename

        with open(filepath, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        logger.info(f"Exported report to {filepath}")

        # Also generate a human-readable summary
        self._export_summary(report, timestamp)

    def _export_summary(self, report: Dict[str, Any], timestamp: str):
        """Export human-readable summary"""
        filename = f"rotation_summary_{timestamp}.txt"
        filepath = self.reports_folder / filename

        summary = report['summary']

        lines = [
            "=" * 60,
            "KMGI WEEKLY ROTATION REPORT",
            "=" * 60,
            f"Period: {report['start_date'][:10]} to {report['end_date'][:10]}",
            f"Generated: {report['generated_at'][:19]}",
            "",
            "SUMMARY",
            "-" * 40,
            f"Total Plays: {summary['total_plays']}",
            f"Unique Songs: {summary['unique_songs_played']}",
            f"Unique Artists: {summary['unique_artists_played']}",
            f"Library Coverage: {summary['library_coverage_percent']}%",
            f"Total Air Time: {summary['total_air_time_hours']} hours",
            "",
            "CATEGORY BREAKDOWN",
            "-" * 40,
        ]

        for cat, data in report['category_breakdown'].items():
            lines.append(f"  {cat}: {data['plays']} plays ({data['percentage']}%)")

        lines.extend([
            "",
            "TOP 10 SONGS",
            "-" * 40,
        ])

        for song in report['top_songs'][:10]:
            lines.append(f"  {song['rank']}. {song['artist']} - {song['title']} ({song['plays']} plays)")

        lines.extend([
            "",
            "RECOMMENDATIONS",
            "-" * 40,
        ])

        for rec in report['recommendations']:
            lines.append(f"  • {rec}")

        if report['rule_violations']:
            lines.extend([
                "",
                f"RULE VIOLATIONS: {len(report['rule_violations'])}",
                "-" * 40,
            ])
            for v in report['rule_violations'][:10]:
                lines.append(f"  [{v['severity'].upper()}] {v['rule_name']}: {v['message']}")

        lines.append("=" * 60)

        with open(filepath, 'w') as f:
            f.write('\n'.join(lines))

        logger.info(f"Exported summary to {filepath}")

    def get_quick_stats(self, hours: int = 24) -> Dict[str, Any]:
        """Get quick statistics for the last N hours"""
        if not self.db:
            return {}

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(hours=hours)

        with self.db.session_scope() as session:
            plays = session.query(PlayLog).filter(
                PlayLog.played_at >= start_date
            ).all()

            unique_songs = len(set(p.song_id for p in plays))
            unique_artists = len(set(p.song.artist for p in plays if p.song))

            category_counts = defaultdict(int)
            for play in plays:
                if play.song:
                    category_counts[play.song.category or 'Unknown'] += 1

            return {
                'period_hours': hours,
                'total_plays': len(plays),
                'unique_songs': unique_songs,
                'unique_artists': unique_artists,
                'categories': dict(category_counts),
                'plays_per_hour': round(len(plays) / hours, 1)
            }
