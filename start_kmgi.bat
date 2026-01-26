@echo off
REM KMGI Radio Automation - Start Script
REM Starts the web dashboard and file watcher

echo ============================================
echo KMGI Radio Automation
echo ============================================

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Start the web dashboard
echo.
echo Starting web dashboard on http://localhost:5000
echo Press Ctrl+C to stop
echo.

python -m src.main web --host 0.0.0.0 --port 5000
