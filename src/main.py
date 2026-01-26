"""
KMGI Radio Music Automation System

Main entry point for the application.
"""

import os
import sys
import logging
from pathlib import Path
from datetime import datetime

import click
import yaml
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.database.db import DatabaseManager
from src.analyzer.audio_analyzer import AudioAnalyzer
from src.analyzer.metadata import MetadataManager
from src.organizer.file_organizer import FileOrganizer
from src.rules.rules_engine import RulesEngine
from src.watcher.nurpe_watcher import NurpeWatcher
from src.audit.rotation_audit import RotationAuditor
from src.opx.opx_integration import OPXIntegration

console = Console()


def load_config(config_path: str = None) -> dict:
    """Load configuration from YAML file"""
    if config_path is None:
        config_path = Path(__file__).parent.parent / 'config' / 'config.yaml'

    config_path = Path(config_path)

    if not config_path.exists():
        # Try example config
        example_path = config_path.with_suffix('.example.yaml')
        if example_path.exists():
            console.print(f"[yellow]Config not found. Using example: {example_path}[/yellow]")
            config_path = example_path
        else:
            console.print("[red]No configuration file found![/red]")
            return {}

    with open(config_path) as f:
        return yaml.safe_load(f)


def setup_logging(config: dict):
    """Setup logging based on configuration"""
    log_config = config.get('logging', {})
    log_level = getattr(logging, log_config.get('level', 'INFO'))
    log_format = log_config.get('format', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')

    log_file = log_config.get('file')
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)

    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(log_file) if log_file else logging.NullHandler()
        ]
    )


@click.group()
@click.option('--config', '-c', default=None, help='Path to configuration file')
@click.pass_context
def cli(ctx, config):
    """KMGI Radio Music Automation System"""
    ctx.ensure_object(dict)
    ctx.obj['config'] = load_config(config)
    setup_logging(ctx.obj['config'])


@cli.command()
@click.pass_context
def init(ctx):
    """Initialize the database and create default configuration"""
    config = ctx.obj['config']

    console.print("[bold]Initializing KMGI Radio Automation...[/bold]")

    # Initialize database
    db_path = config.get('paths', {}).get('app_database', 'data/kmgi.db')
    db = DatabaseManager(db_path)
    db.init_db()
    console.print(f"[green]Database initialized: {db_path}[/green]")

    # Create directories
    paths = config.get('paths', {})
    for name, path in paths.items():
        if path and name != 'app_database':
            Path(path).mkdir(parents=True, exist_ok=True)

    # Create default config if needed
    config_path = Path('config/config.yaml')
    if not config_path.exists():
        example_path = Path('config/config.example.yaml')
        if example_path.exists():
            import shutil
            shutil.copy(example_path, config_path)
            console.print("[green]Created config/config.yaml from example[/green]")

    rules_path = Path('config/rules.yaml')
    if not rules_path.exists():
        example_path = Path('config/rules.example.yaml')
        if example_path.exists():
            import shutil
            shutil.copy(example_path, rules_path)
            console.print("[green]Created config/rules.yaml from example[/green]")

    console.print("[bold green]Initialization complete![/bold green]")


@cli.command()
@click.option('--path', '-p', default=None, help='Path to scan (default: music_library from config)')
@click.pass_context
def scan(ctx, path):
    """Scan and analyze music library"""
    config = ctx.obj['config']

    scan_path = path or config.get('paths', {}).get('music_library', 'music')
    scan_path = Path(scan_path)

    if not scan_path.exists():
        console.print(f"[red]Path not found: {scan_path}[/red]")
        return

    console.print(f"[bold]Scanning: {scan_path}[/bold]")

    # Initialize components
    db_path = config.get('paths', {}).get('app_database', 'data/kmgi.db')
    db = DatabaseManager(db_path)
    db.init_db()

    analyzer = AudioAnalyzer(config)
    metadata_mgr = MetadataManager(config)

    # Find audio files
    extensions = {'.mp3', '.wav', '.flac', '.m4a', '.ogg'}
    files = [f for f in scan_path.rglob('*') if f.is_file() and f.suffix.lower() in extensions]

    console.print(f"Found {len(files)} audio files")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task("Processing...", total=len(files))

        for file_path in files:
            progress.update(task, description=f"Processing: {file_path.name}")

            # Read metadata
            metadata = metadata_mgr.read_metadata(str(file_path))
            if not metadata:
                progress.advance(task)
                continue

            # Analyze audio
            analysis = analyzer.analyze_file(str(file_path))
            if analysis:
                metadata = metadata_mgr.update_from_analysis(metadata, analysis)

            # Add to database
            song_data = metadata.to_dict()
            song_data['file_path'] = str(file_path)
            song_data['date_added'] = datetime.utcnow()
            if analysis:
                song_data['last_analyzed'] = datetime.utcnow()
                song_data['analysis_confidence'] = analysis.confidence

            db.add_song(song_data)
            progress.advance(task)

    # Show stats
    stats = db.get_library_stats()
    console.print("\n[bold]Library Statistics:[/bold]")

    table = Table(show_header=True)
    table.add_column("Metric")
    table.add_column("Value")
    table.add_row("Total Songs", str(stats['total_songs']))
    table.add_row("Active Songs", str(stats['active_songs']))
    console.print(table)


@cli.command()
@click.pass_context
def watch(ctx):
    """Start watching Nurpe download folder for new music"""
    config = ctx.obj['config']

    db_path = config.get('paths', {}).get('app_database', 'data/kmgi.db')
    db = DatabaseManager(db_path)
    db.init_db()

    watcher = NurpeWatcher(config, db)

    def on_processed(file_path, result):
        console.print(f"[green]Processed: {Path(file_path).name}[/green]")
        if result.get('metadata'):
            console.print(f"  → {result['metadata'].get('artist', 'Unknown')} - {result['metadata'].get('title', 'Unknown')}")

    def on_error(file_path, error):
        console.print(f"[red]Error processing {Path(file_path).name}: {error}[/red]")

    watcher.on_file_processed = on_processed
    watcher.on_file_error = on_error

    console.print(f"[bold]Starting watcher...[/bold]")
    console.print(f"Watching: {watcher.watch_path}")
    console.print("Press Ctrl+C to stop\n")

    watcher.start()

    try:
        import time
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopping watcher...[/yellow]")
        watcher.stop()


@cli.command()
@click.option('--week', is_flag=True, help='Generate weekly report')
@click.pass_context
def audit(ctx, week):
    """Generate rotation audit report"""
    config = ctx.obj['config']

    db_path = config.get('paths', {}).get('app_database', 'data/kmgi.db')
    db = DatabaseManager(db_path)

    rules_path = config.get('rules_path', 'config/rules.yaml')
    rules_engine = RulesEngine(rules_path, db)

    auditor = RotationAuditor(config, db, rules_engine)

    console.print("[bold]Generating audit report...[/bold]")

    if week:
        report = auditor.generate_weekly_report()
    else:
        report = {'summary': auditor.get_quick_stats(24)}

    # Display summary
    table = Table(title="Rotation Summary", show_header=True)
    table.add_column("Metric")
    table.add_column("Value")

    for key, value in report['summary'].items():
        table.add_row(key.replace('_', ' ').title(), str(value))

    console.print(table)

    if week and report.get('recommendations'):
        console.print("\n[bold]Recommendations:[/bold]")
        for rec in report['recommendations']:
            console.print(f"  • {rec}")


@cli.command()
@click.option('--to-opx', is_flag=True, help='Sync to OP-X')
@click.option('--from-opx', is_flag=True, help='Import from OP-X')
@click.pass_context
def sync(ctx, to_opx, from_opx):
    """Sync with OP-X radio automation"""
    config = ctx.obj['config']

    db_path = config.get('paths', {}).get('app_database', 'data/kmgi.db')
    db = DatabaseManager(db_path)

    opx = OPXIntegration(config, db)

    if to_opx:
        console.print("[bold]Syncing to OP-X...[/bold]")
        stats = opx.sync_to_opx()
        console.print(f"Added: {stats['added']}, Updated: {stats['updated']}, Errors: {stats['errors']}")

    if from_opx:
        console.print("[bold]Importing from OP-X...[/bold]")
        stats = opx.sync_from_opx()
        console.print(f"Added: {stats['added']}, Updated: {stats['updated']}, Errors: {stats['errors']}")

    if not to_opx and not from_opx:
        console.print("[bold]Verifying sync status...[/bold]")
        status = opx.verify_library_sync()
        console.print(f"Synced: {status['sync_ok']}")
        console.print(f"Missing in OP-X: {len(status['missing_in_opx'])}")
        console.print(f"Missing in KMGI: {len(status['missing_in_kmgi'])}")


@cli.command()
@click.option('--host', '-h', default='0.0.0.0', help='Host to bind to')
@click.option('--port', '-p', default=5000, help='Port to bind to')
@click.option('--debug', is_flag=True, help='Enable debug mode')
@click.pass_context
def web(ctx, host, port, debug):
    """Start the web dashboard"""
    config = ctx.obj['config']

    console.print(f"[bold]Starting web dashboard on http://{host}:{port}[/bold]")

    from src.web.app import create_app
    app = create_app(config)
    app.run(host=host, port=port, debug=debug)


@cli.command()
@click.pass_context
def stats(ctx):
    """Show library statistics"""
    config = ctx.obj['config']

    db_path = config.get('paths', {}).get('app_database', 'data/kmgi.db')
    db = DatabaseManager(db_path)

    stats = db.get_library_stats()

    console.print("[bold]Library Statistics[/bold]\n")

    table = Table(show_header=True)
    table.add_column("Metric")
    table.add_column("Value")
    table.add_row("Total Songs", str(stats['total_songs']))
    table.add_row("Active Songs", str(stats['active_songs']))
    console.print(table)

    if stats['by_category']:
        console.print("\n[bold]By Category:[/bold]")
        cat_table = Table(show_header=True)
        cat_table.add_column("Category")
        cat_table.add_column("Count")
        for cat, count in sorted(stats['by_category'].items(), key=lambda x: x[1], reverse=True):
            cat_table.add_row(cat or 'Uncategorized', str(count))
        console.print(cat_table)

    if stats['by_genre']:
        console.print("\n[bold]By Genre:[/bold]")
        genre_table = Table(show_header=True)
        genre_table.add_column("Genre")
        genre_table.add_column("Count")
        for genre, count in sorted(stats['by_genre'].items(), key=lambda x: x[1], reverse=True)[:10]:
            genre_table.add_row(genre or 'Unknown', str(count))
        console.print(genre_table)

    if stats['by_gender']:
        console.print("\n[bold]By Gender:[/bold]")
        gender_table = Table(show_header=True)
        gender_table.add_column("Gender")
        gender_table.add_column("Count")
        for gender, count in sorted(stats['by_gender'].items(), key=lambda x: x[1], reverse=True):
            gender_table.add_row(gender or 'Unknown', str(count))
        console.print(gender_table)


@cli.command()
@click.argument('file_path')
@click.pass_context
def process(ctx, file_path):
    """Process a single audio file"""
    config = ctx.obj['config']

    file_path = Path(file_path)
    if not file_path.exists():
        console.print(f"[red]File not found: {file_path}[/red]")
        return

    db_path = config.get('paths', {}).get('app_database', 'data/kmgi.db')
    db = DatabaseManager(db_path)
    db.init_db()

    watcher = NurpeWatcher(config, db)
    result = watcher.process_single(str(file_path))

    if result['status'] == 'success':
        console.print("[green]Processing successful![/green]")
    else:
        console.print(f"[yellow]Processing completed with issues[/yellow]")

    if result.get('metadata'):
        meta = result['metadata']
        console.print(f"\n[bold]Metadata:[/bold]")
        console.print(f"  Title: {meta.get('title', 'Unknown')}")
        console.print(f"  Artist: {meta.get('artist', 'Unknown')}")
        console.print(f"  Category: {meta.get('category', 'Not set')}")
        console.print(f"  Genre: {meta.get('genre', 'Not set')}")
        console.print(f"  Tempo: {meta.get('tempo', 'Unknown')}")
        console.print(f"  Mood: {meta.get('mood', 'Unknown')}")
        console.print(f"  Gender: {meta.get('gender', 'Unknown')}")

    if result.get('analysis'):
        analysis = result['analysis']
        console.print(f"\n[bold]Audio Analysis:[/bold]")
        console.print(f"  BPM: {analysis.get('tempo', 'N/A')}")
        console.print(f"  Energy: {analysis.get('energy', 'N/A')}")
        console.print(f"  Danceability: {analysis.get('danceability', 'N/A')}")

    if result.get('new_path'):
        console.print(f"\n[bold]Organized to:[/bold] {result['new_path']}")

    if result.get('errors'):
        console.print(f"\n[yellow]Warnings:[/yellow]")
        for error in result['errors']:
            console.print(f"  • {error}")


if __name__ == '__main__':
    cli()
