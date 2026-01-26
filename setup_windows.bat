@echo off
REM KMGI Radio Automation - Windows Setup Script
REM Run this as Administrator on your OP-X server

echo ============================================
echo KMGI Radio Automation - Windows Setup
echo ============================================
echo.

REM Check for Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed!
    echo.
    echo Please download Python 3.9+ from:
    echo https://www.python.org/downloads/
    echo.
    echo IMPORTANT: Check "Add Python to PATH" during installation
    pause
    exit /b 1
)

echo [OK] Python found
python --version

REM Check for pip
pip --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] pip is not installed!
    pause
    exit /b 1
)

echo [OK] pip found

REM Create virtual environment
echo.
echo Creating virtual environment...
if not exist "venv" (
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Upgrade pip
echo.
echo Upgrading pip...
python -m pip install --upgrade pip

REM Install requirements
echo.
echo Installing dependencies (this may take a few minutes)...
pip install -r requirements.txt

REM Install Windows-specific packages
echo.
echo Installing Windows-specific packages...
pip install pywin32 pyodbc

REM Create directories
echo.
echo Creating directories...
if not exist "data" mkdir data
if not exist "logs" mkdir logs
if not exist "reports" mkdir reports
if not exist "config" mkdir config

REM Copy example configs if needed
if not exist "config\config.yaml" (
    echo Creating config\config.yaml...
    copy "config\config.example.yaml" "config\config.yaml"
)

if not exist "config\rules.yaml" (
    echo Creating config\rules.yaml...
    copy "config\rules.example.yaml" "config\rules.yaml"
)

REM Initialize database
echo.
echo Initializing database...
python -m src.main init

echo.
echo ============================================
echo Setup Complete!
echo ============================================
echo.
echo Next steps:
echo 1. Edit config\config.yaml with your paths
echo 2. Edit config\rules.yaml with your rotation rules
echo 3. Run: start_kmgi.bat
echo.
pause
