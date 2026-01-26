# KMGI Radio Music Automation System

A comprehensive radio automation management system designed to integrate with OP-X radio automation software.

## Features

- **Audio Analysis**: Automatically analyze songs for tempo (BPM), genre, mood, and energy
- **Metadata Management**: Read and update song metadata (ID3 tags) with radio-specific fields
- **File Organization**: Automatically categorize and organize music into folder structure
- **Nurpe Integration**: Watch download folder and auto-process new music
- **OP-X Integration**: Two-way sync with OP-X radio automation database
- **Rules Engine**: Create and enforce rotation rules (separation, gender balance, tempo flow)
- **Rotation Auditing**: Weekly reports with rule violation detection
- **Web Dashboard**: Browser-based management interface

---

## Windows Installation (OP-X Server)

### Prerequisites

1. **Python 3.9 or higher**
   - Download from: https://www.python.org/downloads/
   - **IMPORTANT**: Check ✅ "Add Python to PATH" during installation

2. **Microsoft Access Driver** (usually pre-installed on Windows)

### Quick Setup

1. **Download KMGI** to your OP-X server (e.g., `C:\KMGI`)

2. **Run the setup script** (as Administrator):
   ```
   Right-click setup_windows.bat → Run as administrator
   ```

3. **Configure your paths** - Edit `config\config.yaml`:
   ```yaml
   paths:
     music_library: "C:\\Radio\\Music"
     nurpe_downloads: "C:\\Users\\Radio\\Downloads\\Nurpe"

   opx:
     database: "C:\\OP-X\\Data\\Library.mdb"
   ```

4. **Start KMGI**:
   - Double-click `KMGI_Launcher.pyw` for the GUI launcher
   - Or run `start_kmgi.bat` for command line

5. **Open the dashboard**: http://localhost:5000

### Install as Windows Service (Auto-Start)

To run KMGI automatically when Windows starts:

```
Right-click install_service.bat → Run as administrator
```

Then start the service:
```
net start KMGIRadioAutomation
```

---

## Configuration

### Main Config (`config/config.yaml`)

```yaml
# File paths
paths:
  music_library: "C:\\Radio\\Music"           # Organized music folder
  nurpe_downloads: "C:\\Users\\Radio\\Downloads\\Nurpe"  # Watch folder
  app_database: "C:\\KMGI\\data\\kmgi.db"     # KMGI database

# OP-X connection
opx:
  database: "C:\\OP-X\\Data\\Library.mdb"     # OP-X database file
  version: "3.0"

# File organization
organization:
  root: "C:\\Radio\\Music"
  structure: "{category}\\{genre}\\{artist}"  # Folder structure
  filename: "{artist} - {title}"              # File naming

# Web dashboard
web:
  port: 5000
```

### Rotation Rules (`config/rules.yaml`)

```yaml
# Song separation
settings:
  song_separation: 180      # Minutes before song can repeat
  artist_separation: 60     # Minutes before artist can repeat

# Hourly rotation percentages
hourly_rules:
  - hours: [6, 7, 8, 9]     # Morning Drive
    name: "Morning Drive"
    rules:
      - category: "Current"
        percentage: 40
      - category: "Power Gold"
        percentage: 30
      - category: "Recurrent"
        percentage: 20
      - category: "Gold"
        percentage: 10

# Gender balance
gender_rules:
  max_consecutive_same_gender: 3

# Tempo flow
tempo_rules:
  max_consecutive_slow: 2
  max_consecutive_fast: 3
```

---

## Usage

### GUI Launcher
Double-click `KMGI_Launcher.pyw` to open the control panel.

### Web Dashboard
Access at http://localhost:5000 after starting.

| Page | Description |
|------|-------------|
| Dashboard | Overview stats, quick actions |
| Library | Browse, search, edit songs |
| Categories | Manage rotation categories |
| Rules | View/edit rotation rules |
| Watcher | Control Nurpe folder monitoring |
| Audit | Generate rotation reports |
| OP-X Sync | Sync with OP-X database |

### Command Line

```bash
# Initialize database
python -m src.main init

# Start web dashboard
python -m src.main web --port 5000

# Scan and analyze music library
python -m src.main scan --path "C:\Radio\Music"

# Watch for new downloads
python -m src.main watch

# Process a single file
python -m src.main process "C:\Downloads\song.mp3"

# Generate weekly audit report
python -m src.main audit --week

# Show library statistics
python -m src.main stats

# Sync to OP-X
python -m src.main sync --to-opx

# Import from OP-X
python -m src.main sync --from-opx
```

---

## How It Works

### Nurpe Download Processing

1. **Watcher detects new file** in download folder
2. **Audio analysis** extracts tempo, energy, mood
3. **Metadata read** from ID3 tags (title, artist, genre)
4. **Auto-categorization** based on analysis:
   - New music → "Current" category
   - Detects tempo: Slow/Medium/Fast
   - Suggests mood and genre
5. **File organized** into folder structure:
   ```
   Music/
   ├── Current/
   │   ├── Pop/
   │   │   └── Taylor Swift/
   │   │       └── Taylor Swift - Song.mp3
   ```
6. **Metadata updated** with radio fields (intro, outro, category)
7. **Database updated** with song info
8. **OP-X synced** with new song data

### Categories

| Category | Code | Description |
|----------|------|-------------|
| Current | CUR | New releases in heavy rotation |
| Recurrent | REC | Recent hits transitioning out |
| Power Gold | PWG | All-time hits, high familiarity |
| Gold | GLD | Classic hits |
| Deep Cut | DPC | Album tracks, lesser-known |

### Song Attributes

- **Gender**: Male, Female, Group, Mixed, Instrumental
- **Tempo**: Slow (<80 BPM), Medium (80-120 BPM), Fast (>120 BPM)
- **Mood**: Happy, Sad, Energetic, Calm, Romantic, Uplifting, Melancholic
- **Energy**: Low, Medium, High

---

## Troubleshooting

### OP-X Database Connection Error

```
Error: Could not connect to OP-X database
```

1. Check the database path in `config/config.yaml`
2. Make sure OP-X is not exclusively locking the database
3. Install Microsoft Access Database Engine if needed:
   https://www.microsoft.com/en-us/download/details.aspx?id=54920

### Audio Analysis Slow/Failing

The audio analysis uses `librosa` which can be CPU-intensive:

1. Ensure all dependencies installed: `pip install librosa numpy scipy`
2. For faster processing, disable analysis in config:
   ```yaml
   analysis:
     enabled: false
   ```

### Files Not Being Detected

1. Check the watch folder path in config
2. Ensure file extensions are in the allowed list
3. Check the logs: `logs/kmgi.log`

---

## File Structure

```
C:\KMGI\
├── config/
│   ├── config.yaml          # Main configuration
│   └── rules.yaml            # Rotation rules
├── data/
│   └── kmgi.db               # Application database
├── logs/
│   └── kmgi.log              # Log file
├── reports/
│   └── rotation_report_*.json
├── src/                      # Source code
├── KMGI_Launcher.pyw         # GUI launcher
├── start_kmgi.bat            # Start script
├── setup_windows.bat         # Setup script
└── install_service.bat       # Service installer
```

---

## License

Proprietary - Knox Media Group Inc.
