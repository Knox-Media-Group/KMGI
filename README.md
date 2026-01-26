# KMGI Radio Music Automation System

A comprehensive radio automation management system designed to integrate with OP-X radio automation software.

## Features

- **Audio Analysis**: Automatically analyze songs for tempo, genre, mood, and energy
- **Metadata Management**: Read and update song metadata (ID3 tags)
- **File Organization**: Automatically categorize and organize music files
- **Nurpe Integration**: Watch for new downloads and auto-categorize
- **OP-X Integration**: Sync music library with OP-X database
- **Rules Engine**: Create and enforce rotation rules
- **Rotation Auditing**: Weekly reports on playlist rotation

## Installation

```bash
# Install Python dependencies
pip install -r requirements.txt

# Copy and configure settings
cp config/config.example.yaml config/config.yaml

# Initialize the database
python -m src.main init

# Run the application
python -m src.main run
```

## Configuration

Edit `config/config.yaml` to set:
- Music library paths
- OP-X database location
- Nurpe download folder
- Category definitions

Edit `config/rules.yaml` to define rotation rules.

## Usage

### Web Dashboard
```bash
python -m src.web.app
```
Access at http://localhost:5000

### CLI Commands
```bash
# Scan and analyze music library
python -m src.main scan

# Watch for new Nurpe downloads
python -m src.main watch

# Generate rotation audit report
python -m src.main audit --week

# Sync with OP-X
python -m src.main sync
```

## Categories

Songs are categorized by:
- **Gender**: Male, Female, Group, Mixed, Instrumental
- **Genre**: Pop, Rock, R&B, Hip-Hop, Country, etc.
- **Tempo**: Slow (<80 BPM), Medium (80-120 BPM), Fast (>120 BPM)
- **Mood**: Happy, Sad, Energetic, Calm, Romantic, etc.
- **Category**: Current, Recurrent, Gold, Power Gold, etc.

## License

Proprietary - Knox Media Group Inc.
