@echo off
REM KMGI Radio Automation - Start File Watcher Only
REM Monitors Nurpe download folder for new music

echo ============================================
echo KMGI Radio Automation - File Watcher
echo ============================================

REM Activate virtual environment
call venv\Scripts\activate.bat

echo.
echo Starting Nurpe folder watcher...
echo New music files will be automatically processed
echo Press Ctrl+C to stop
echo.

python -m src.main watch
