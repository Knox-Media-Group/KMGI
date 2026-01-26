"""
Rules Engine for KMGI Radio Automation

Enforces rotation rules for proper song scheduling.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from pathlib import Path

import yaml

from ..database.models import Song, PlayLog
from ..database.db import DatabaseManager

logger = logging.getLogger(__name__)


@dataclass
class RuleViolation:
    """Represents a rule violation"""
    rule_name: str
    rule_type: str
    severity: str  # 'warning', 'error', 'critical'
    message: str
    song_id: Optional[int] = None
    song_title: Optional[str] = None
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        return {
            'rule_name': self.rule_name,
            'rule_type': self.rule_type,
            'severity': self.severity,
            'message': self.message,
            'song_id': self.song_id,
            'song_title': self.song_title,
            'timestamp': self.timestamp.isoformat(),
        }


class RulesEngine:
    """
    Enforces rotation rules for radio scheduling.

    Rules are loaded from YAML configuration and can be:
    - Hourly rules (what categories play when)
    - Separation rules (time between repeats)
    - Gender balance rules
    - Tempo flow rules
    - Genre mixing rules
    """

    def __init__(self, rules_path: str = None, db: DatabaseManager = None):
        """
        Initialize the rules engine.

        Args:
            rules_path: Path to rules YAML file
            db: Database manager instance
        """
        self.db = db
        self.rules = {}
        self.violations = []

        if rules_path:
            self.load_rules(rules_path)

    def load_rules(self, rules_path: str):
        """Load rules from YAML file"""
        path = Path(rules_path)
        if not path.exists():
            logger.warning(f"Rules file not found: {rules_path}")
            return

        with open(path, 'r') as f:
            self.rules = yaml.safe_load(f)

        logger.info(f"Loaded rules from {rules_path}")

    def save_rules(self, rules_path: str):
        """Save current rules to YAML file"""
        path = Path(rules_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, 'w') as f:
            yaml.dump(self.rules, f, default_flow_style=False, sort_keys=False)

        logger.info(f"Saved rules to {rules_path}")

    # Rule checking methods

    def can_play_song(self, song: Song, context: Dict[str, Any] = None) -> Tuple[bool, List[RuleViolation]]:
        """
        Check if a song can be played according to all rules.

        Args:
            song: Song to check
            context: Context including recent plays, current hour, etc.

        Returns:
            Tuple of (can_play, list of violations)
        """
        context = context or {}
        violations = []

        # Check song separation
        sep_violations = self.check_song_separation(song, context)
        violations.extend(sep_violations)

        # Check artist separation
        artist_violations = self.check_artist_separation(song, context)
        violations.extend(artist_violations)

        # Check hourly rules
        hourly_violations = self.check_hourly_rules(song, context)
        violations.extend(hourly_violations)

        # Check tempo flow
        tempo_violations = self.check_tempo_rules(song, context)
        violations.extend(tempo_violations)

        # Check gender balance
        gender_violations = self.check_gender_rules(song, context)
        violations.extend(gender_violations)

        # Check genre limits
        genre_violations = self.check_genre_rules(song, context)
        violations.extend(genre_violations)

        # Check dayparting (explicit content, etc.)
        daypart_violations = self.check_dayparting_rules(song, context)
        violations.extend(daypart_violations)

        # Determine if song can play (no critical violations)
        can_play = not any(v.severity == 'critical' for v in violations)

        return can_play, violations

    def check_song_separation(self, song: Song, context: Dict[str, Any]) -> List[RuleViolation]:
        """Check if song has rested long enough since last play"""
        violations = []
        settings = self.rules.get('settings', {})
        min_separation = settings.get('song_separation', 180)  # minutes

        if song.last_played:
            minutes_since = (datetime.utcnow() - song.last_played).total_seconds() / 60
            if minutes_since < min_separation:
                violations.append(RuleViolation(
                    rule_name="Song Separation",
                    rule_type="separation",
                    severity="critical",
                    message=f"Song played {int(minutes_since)} minutes ago (min: {min_separation})",
                    song_id=song.id,
                    song_title=song.title
                ))

        return violations

    def check_artist_separation(self, song: Song, context: Dict[str, Any]) -> List[RuleViolation]:
        """Check if artist has been played too recently"""
        violations = []
        settings = self.rules.get('settings', {})
        min_separation = settings.get('artist_separation', 60)  # minutes

        recent_plays = context.get('recent_plays', [])

        for play in recent_plays:
            if hasattr(play, 'song') and play.song:
                if play.song.artist.lower() == song.artist.lower():
                    minutes_since = (datetime.utcnow() - play.played_at).total_seconds() / 60
                    if minutes_since < min_separation:
                        violations.append(RuleViolation(
                            rule_name="Artist Separation",
                            rule_type="separation",
                            severity="critical",
                            message=f"Artist '{song.artist}' played {int(minutes_since)} min ago (min: {min_separation})",
                            song_id=song.id,
                            song_title=song.title
                        ))
                        break

        return violations

    def check_hourly_rules(self, song: Song, context: Dict[str, Any]) -> List[RuleViolation]:
        """Check if song's category is appropriate for current hour"""
        violations = []
        current_hour = context.get('hour', datetime.utcnow().hour)
        hourly_rules = self.rules.get('hourly_rules', [])

        for rule_set in hourly_rules:
            if current_hour in rule_set.get('hours', []):
                # Found matching hour rule
                allowed_categories = [r.get('category') for r in rule_set.get('rules', [])]

                if song.category and song.category not in allowed_categories:
                    violations.append(RuleViolation(
                        rule_name=f"Hourly Rule: {rule_set.get('name', 'Unknown')}",
                        rule_type="hourly",
                        severity="warning",
                        message=f"Category '{song.category}' not scheduled for hour {current_hour}",
                        song_id=song.id,
                        song_title=song.title
                    ))

                # Check restrictions
                for restriction in rule_set.get('restrictions', []):
                    if restriction.get('action') == 'avoid':
                        avoid_moods = restriction.get('mood', [])
                        if song.mood in avoid_moods:
                            violations.append(RuleViolation(
                                rule_name=f"Hourly Restriction: {restriction.get('reason', 'No reason')}",
                                rule_type="hourly",
                                severity="error",
                                message=f"Mood '{song.mood}' should be avoided during this daypart",
                                song_id=song.id,
                                song_title=song.title
                            ))

                break

        return violations

    def check_tempo_rules(self, song: Song, context: Dict[str, Any]) -> List[RuleViolation]:
        """Check tempo flow rules"""
        violations = []
        tempo_rules = self.rules.get('tempo_rules', {})
        recent_songs = context.get('recent_songs', [])

        if not recent_songs:
            return violations

        max_consecutive_slow = tempo_rules.get('max_consecutive_slow', 2)
        max_consecutive_fast = tempo_rules.get('max_consecutive_fast', 3)

        # Count consecutive same-tempo songs
        consecutive_slow = 0
        consecutive_fast = 0

        for recent in recent_songs[-5:]:  # Check last 5 songs
            if hasattr(recent, 'tempo'):
                if recent.tempo == "Slow":
                    consecutive_slow += 1
                    consecutive_fast = 0
                elif recent.tempo == "Fast":
                    consecutive_fast += 1
                    consecutive_slow = 0
                else:
                    consecutive_slow = 0
                    consecutive_fast = 0

        if song.tempo == "Slow" and consecutive_slow >= max_consecutive_slow:
            violations.append(RuleViolation(
                rule_name="Tempo Flow",
                rule_type="tempo",
                severity="warning",
                message=f"Too many slow songs in a row ({consecutive_slow + 1})",
                song_id=song.id,
                song_title=song.title
            ))

        if song.tempo == "Fast" and consecutive_fast >= max_consecutive_fast:
            violations.append(RuleViolation(
                rule_name="Tempo Flow",
                rule_type="tempo",
                severity="warning",
                message=f"Too many fast songs in a row ({consecutive_fast + 1})",
                song_id=song.id,
                song_title=song.title
            ))

        return violations

    def check_gender_rules(self, song: Song, context: Dict[str, Any]) -> List[RuleViolation]:
        """Check gender balance rules"""
        violations = []
        gender_rules = self.rules.get('gender_rules', {})
        recent_songs = context.get('recent_songs', [])

        max_consecutive = gender_rules.get('max_consecutive_same_gender', 3)

        if not recent_songs:
            return violations

        # Count consecutive same gender
        consecutive = 0
        for recent in reversed(recent_songs[-max_consecutive:]):
            if hasattr(recent, 'gender') and recent.gender == song.gender:
                consecutive += 1
            else:
                break

        if consecutive >= max_consecutive:
            violations.append(RuleViolation(
                rule_name="Gender Balance",
                rule_type="gender",
                severity="warning",
                message=f"Too many consecutive {song.gender} artists ({consecutive + 1})",
                song_id=song.id,
                song_title=song.title
            ))

        return violations

    def check_genre_rules(self, song: Song, context: Dict[str, Any]) -> List[RuleViolation]:
        """Check genre mixing rules"""
        violations = []
        genre_rules = self.rules.get('genre_rules', {})
        recent_songs = context.get('recent_songs', [])
        hourly_plays = context.get('hourly_genre_counts', {})

        # Check same genre separation
        separation = genre_rules.get('same_genre_separation', 2)
        for i, recent in enumerate(reversed(recent_songs[:separation])):
            if hasattr(recent, 'genre') and recent.genre == song.genre:
                violations.append(RuleViolation(
                    rule_name="Genre Separation",
                    rule_type="genre",
                    severity="warning",
                    message=f"Same genre '{song.genre}' played {i + 1} songs ago (min separation: {separation})",
                    song_id=song.id,
                    song_title=song.title
                ))
                break

        # Check hourly limits
        for limit in genre_rules.get('hourly_limits', []):
            if limit['genre'] == song.genre:
                max_per_hour = limit.get('max_per_hour', 999)
                current_count = hourly_plays.get(song.genre, 0)
                if current_count >= max_per_hour:
                    violations.append(RuleViolation(
                        rule_name="Genre Hourly Limit",
                        rule_type="genre",
                        severity="error",
                        message=f"Max {song.genre} songs reached for this hour ({max_per_hour})",
                        song_id=song.id,
                        song_title=song.title
                    ))

        return violations

    def check_dayparting_rules(self, song: Song, context: Dict[str, Any]) -> List[RuleViolation]:
        """Check dayparting rules (explicit content, etc.)"""
        violations = []
        special_rules = self.rules.get('special_rules', {})
        dayparting = special_rules.get('dayparting', [])
        current_hour = context.get('hour', datetime.utcnow().hour)
        current_day = context.get('day_of_week', datetime.utcnow().weekday())

        for rule in dayparting:
            hours = rule.get('hours', list(range(24)))
            days = rule.get('days', list(range(7)))

            if current_hour in hours and current_day in days:
                condition = rule.get('condition', {})

                # Check explicit content restriction
                if 'explicit' in condition:
                    if song.explicit and not condition['explicit']:
                        violations.append(RuleViolation(
                            rule_name=f"Dayparting: {rule.get('name', 'Unknown')}",
                            rule_type="dayparting",
                            severity="critical",
                            message="Explicit content not allowed during this daypart",
                            song_id=song.id,
                            song_title=song.title
                        ))

        return violations

    # Selection methods

    def get_category_for_hour(self, hour: int) -> Dict[str, float]:
        """
        Get category percentages for a specific hour.

        Returns:
            Dictionary mapping category names to their percentage
        """
        hourly_rules = self.rules.get('hourly_rules', [])

        for rule_set in hourly_rules:
            if hour in rule_set.get('hours', []):
                percentages = {}
                for rule in rule_set.get('rules', []):
                    percentages[rule['category']] = rule.get('percentage', 0)
                return percentages

        # Default if no rule matches
        return {
            'Current': 30,
            'Recurrent': 25,
            'Power Gold': 25,
            'Gold': 15,
            'Deep Cut': 5
        }

    def select_next_song(self, context: Dict[str, Any]) -> Optional[Song]:
        """
        Select the next song to play based on rules.

        Args:
            context: Current context including recent plays, hour, etc.

        Returns:
            Selected song or None if no eligible song found
        """
        if not self.db:
            logger.error("Database not configured for song selection")
            return None

        current_hour = context.get('hour', datetime.utcnow().hour)
        category_weights = self.get_category_for_hour(current_hour)

        # Get recent artists to avoid
        recent_plays = context.get('recent_plays', [])
        recent_artists = [p.song.artist for p in recent_plays if hasattr(p, 'song') and p.song]

        # Try each category by weight
        import random
        weighted_categories = []
        for cat, weight in category_weights.items():
            weighted_categories.extend([cat] * int(weight))

        random.shuffle(weighted_categories)

        for category in weighted_categories:
            songs = self.db.get_eligible_songs(
                category=category,
                excluded_artists=recent_artists[:5]
            )

            # Filter by rules
            for song in songs:
                can_play, violations = self.can_play_song(song, context)
                if can_play:
                    return song

        logger.warning("No eligible songs found matching all rules")
        return None

    # Reporting methods

    def get_rule_summary(self) -> Dict[str, Any]:
        """Get a summary of all active rules"""
        return {
            'settings': self.rules.get('settings', {}),
            'hourly_rules_count': len(self.rules.get('hourly_rules', [])),
            'gender_rules': self.rules.get('gender_rules', {}),
            'tempo_rules': self.rules.get('tempo_rules', {}),
            'genre_rules': self.rules.get('genre_rules', {}),
            'special_rules_count': len(self.rules.get('special_rules', {}).get('dayparting', []))
        }

    def validate_rules(self) -> List[str]:
        """Validate rules configuration and return any errors"""
        errors = []

        # Check required sections
        if not self.rules:
            errors.append("No rules loaded")
            return errors

        if 'settings' not in self.rules:
            errors.append("Missing 'settings' section")

        if 'hourly_rules' not in self.rules:
            errors.append("Missing 'hourly_rules' section")
        else:
            # Check all hours are covered
            covered_hours = set()
            for rule_set in self.rules['hourly_rules']:
                covered_hours.update(rule_set.get('hours', []))
            missing = set(range(24)) - covered_hours
            if missing:
                errors.append(f"Hours not covered by rules: {sorted(missing)}")

            # Check percentages add up to 100
            for rule_set in self.rules['hourly_rules']:
                total = sum(r.get('percentage', 0) for r in rule_set.get('rules', []))
                if total != 100:
                    errors.append(f"Percentages for '{rule_set.get('name')}' sum to {total}, not 100")

        return errors
