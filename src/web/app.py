"""
Web Dashboard for KMGI Radio Automation

Flask-based web interface for managing the radio automation system.
"""

import os
import logging
from pathlib import Path
from datetime import datetime
from functools import wraps

from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_cors import CORS

from ..database.db import DatabaseManager
from ..database.models import Song, Category
from ..analyzer.audio_analyzer import AudioAnalyzer
from ..analyzer.metadata import MetadataManager
from ..organizer.file_organizer import FileOrganizer
from ..rules.rules_engine import RulesEngine
from ..watcher.nurpe_watcher import NurpeWatcher
from ..audit.rotation_audit import RotationAuditor
from ..opx.opx_integration import OPXIntegration

logger = logging.getLogger(__name__)


def create_app(config: dict = None) -> Flask:
    """Create and configure the Flask application"""

    app = Flask(__name__,
                template_folder='templates',
                static_folder='static')

    # Configuration
    config = config or {}
    web_config = config.get('web', {})
    app.secret_key = web_config.get('secret_key', 'dev-secret-key-change-me')
    app.config['DEBUG'] = web_config.get('debug', False)

    CORS(app)

    # Initialize components
    db_path = config.get('paths', {}).get('app_database', 'data/kmgi.db')
    db = DatabaseManager(db_path)
    db.init_db()

    rules_path = config.get('rules_path', 'config/rules.yaml')
    rules_engine = RulesEngine(rules_path, db)

    watcher = NurpeWatcher(config, db)
    auditor = RotationAuditor(config, db, rules_engine)
    opx = OPXIntegration(config, db)

    # Store components on app
    app.db = db
    app.rules_engine = rules_engine
    app.watcher = watcher
    app.auditor = auditor
    app.opx = opx
    app.config_data = config

    # Register routes
    register_routes(app)

    return app


def register_routes(app: Flask):
    """Register all routes for the web application"""

    # Dashboard
    @app.route('/')
    def dashboard():
        """Main dashboard view"""
        stats = app.auditor.get_quick_stats(24)
        library_stats = app.db.get_library_stats()
        watcher_status = app.watcher.get_status()

        return render_template('dashboard.html',
                             stats=stats,
                             library_stats=library_stats,
                             watcher_status=watcher_status)

    # Library Management
    @app.route('/library')
    def library():
        """Music library view"""
        page = request.args.get('page', 1, type=int)
        per_page = 50
        search = request.args.get('search', '')
        category = request.args.get('category', '')

        with app.db.session_scope() as session:
            query = session.query(Song)

            if search:
                query = query.filter(
                    (Song.title.ilike(f'%{search}%')) |
                    (Song.artist.ilike(f'%{search}%'))
                )

            if category:
                query = query.filter(Song.category == category)

            total = query.count()
            songs = query.offset((page - 1) * per_page).limit(per_page).all()
            categories = session.query(Category).all()

        return render_template('library.html',
                             songs=songs,
                             categories=categories,
                             page=page,
                             total=total,
                             per_page=per_page,
                             search=search,
                             selected_category=category)

    @app.route('/library/song/<int:song_id>')
    def song_detail(song_id):
        """Song detail view"""
        with app.db.session_scope() as session:
            song = session.query(Song).filter_by(id=song_id).first()
            if not song:
                flash('Song not found', 'error')
                return redirect(url_for('library'))

            # Get recent plays
            recent_plays = song.play_logs[-20:] if song.play_logs else []

        return render_template('song_detail.html',
                             song=song,
                             recent_plays=recent_plays)

    @app.route('/api/song/<int:song_id>', methods=['PUT'])
    def update_song(song_id):
        """Update song metadata"""
        data = request.get_json()

        with app.db.session_scope() as session:
            song = session.query(Song).filter_by(id=song_id).first()
            if not song:
                return jsonify({'error': 'Song not found'}), 404

            # Update allowed fields
            allowed_fields = ['category', 'genre', 'mood', 'tempo', 'gender',
                            'energy', 'explicit', 'is_active', 'rating']

            for field in allowed_fields:
                if field in data:
                    setattr(song, field, data[field])

            song.last_modified = datetime.utcnow()

        return jsonify({'success': True, 'message': 'Song updated'})

    # Rules Management
    @app.route('/rules')
    def rules():
        """Rules management view"""
        rule_summary = app.rules_engine.get_rule_summary()
        validation_errors = app.rules_engine.validate_rules()

        return render_template('rules.html',
                             rules=app.rules_engine.rules,
                             summary=rule_summary,
                             errors=validation_errors)

    @app.route('/api/rules', methods=['GET'])
    def get_rules():
        """Get all rules as JSON"""
        return jsonify(app.rules_engine.rules)

    @app.route('/api/rules', methods=['PUT'])
    def update_rules():
        """Update rules configuration"""
        data = request.get_json()
        app.rules_engine.rules = data

        rules_path = app.config_data.get('rules_path', 'config/rules.yaml')
        app.rules_engine.save_rules(rules_path)

        return jsonify({'success': True, 'message': 'Rules saved'})

    # Categories
    @app.route('/categories')
    def categories():
        """Category management view"""
        with app.db.session_scope() as session:
            cats = session.query(Category).order_by(Category.priority.desc()).all()
            stats = {}

            for cat in cats:
                count = session.query(Song).filter_by(
                    category=cat.name, is_active=True
                ).count()
                stats[cat.name] = count

        return render_template('categories.html',
                             categories=cats,
                             stats=stats)

    # Watcher
    @app.route('/watcher')
    def watcher_page():
        """Nurpe watcher management"""
        status = app.watcher.get_status()
        return render_template('watcher.html', status=status)

    @app.route('/api/watcher/start', methods=['POST'])
    def start_watcher():
        """Start the file watcher"""
        app.watcher.start()
        return jsonify({'success': True, 'message': 'Watcher started'})

    @app.route('/api/watcher/stop', methods=['POST'])
    def stop_watcher():
        """Stop the file watcher"""
        app.watcher.stop()
        return jsonify({'success': True, 'message': 'Watcher stopped'})

    @app.route('/api/watcher/scan', methods=['POST'])
    def scan_folder():
        """Scan existing files in watch folder"""
        stats = app.watcher.scan_existing()
        return jsonify({'success': True, 'stats': stats})

    # Audit & Reports
    @app.route('/audit')
    def audit():
        """Audit and reports view"""
        quick_stats = app.auditor.get_quick_stats(24)
        weekly_stats = app.auditor.get_quick_stats(168)  # 7 days

        with app.db.session_scope() as session:
            recent_reports = app.db.get_recent_audits(5)

        return render_template('audit.html',
                             quick_stats=quick_stats,
                             weekly_stats=weekly_stats,
                             recent_reports=recent_reports)

    @app.route('/api/audit/generate', methods=['POST'])
    def generate_audit():
        """Generate a new audit report"""
        report = app.auditor.generate_weekly_report()
        return jsonify({
            'success': True,
            'message': 'Report generated',
            'summary': report['summary'],
            'recommendations': report['recommendations']
        })

    # OP-X Sync
    @app.route('/sync')
    def sync_page():
        """OP-X synchronization page"""
        sync_status = app.opx.verify_library_sync() if app.opx.opx_db_path else {}
        return render_template('sync.html', sync_status=sync_status)

    @app.route('/api/sync/to-opx', methods=['POST'])
    def sync_to_opx():
        """Sync KMGI library to OP-X"""
        stats = app.opx.sync_to_opx()
        return jsonify({'success': True, 'stats': stats})

    @app.route('/api/sync/from-opx', methods=['POST'])
    def sync_from_opx():
        """Import from OP-X to KMGI"""
        stats = app.opx.sync_from_opx()
        return jsonify({'success': True, 'stats': stats})

    # API Endpoints
    @app.route('/api/stats')
    def api_stats():
        """Get current statistics"""
        hours = request.args.get('hours', 24, type=int)
        stats = app.auditor.get_quick_stats(hours)
        return jsonify(stats)

    @app.route('/api/library/stats')
    def api_library_stats():
        """Get library statistics"""
        return jsonify(app.db.get_library_stats())

    @app.route('/api/search')
    def api_search():
        """Search songs"""
        query = request.args.get('q', '')
        if len(query) < 2:
            return jsonify([])

        songs = app.db.search_songs(query, limit=20)
        return jsonify([s.to_dict() for s in songs])

    # Process single file
    @app.route('/api/process', methods=['POST'])
    def process_file():
        """Process a single file"""
        data = request.get_json()
        file_path = data.get('file_path')

        if not file_path or not Path(file_path).exists():
            return jsonify({'error': 'Invalid file path'}), 400

        result = app.watcher.process_single(file_path)
        return jsonify(result)

    # Error handlers
    @app.errorhandler(404)
    def not_found(e):
        return render_template('error.html', error='Page not found'), 404

    @app.errorhandler(500)
    def server_error(e):
        return render_template('error.html', error='Server error'), 500


# Run the application
if __name__ == '__main__':
    import yaml

    # Load configuration
    config_path = Path('config/config.yaml')
    if config_path.exists():
        with open(config_path) as f:
            config = yaml.safe_load(f)
    else:
        config = {}

    app = create_app(config)
    app.run(
        host=config.get('web', {}).get('host', '0.0.0.0'),
        port=config.get('web', {}).get('port', 5000),
        debug=config.get('web', {}).get('debug', True)
    )
