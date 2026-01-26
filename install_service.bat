@echo off
REM KMGI Radio Automation - Install as Windows Service
REM Run this as Administrator

echo ============================================
echo KMGI Service Installer
echo ============================================
echo.

REM Check for admin rights
net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Please run this script as Administrator!
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

REM Get current directory
set KMGI_PATH=%~dp0
set KMGI_PATH=%KMGI_PATH:~0,-1%

echo Installing KMGI as a Windows service...
echo Path: %KMGI_PATH%
echo.

REM Activate virtual environment and install pywin32
call "%KMGI_PATH%\venv\Scripts\activate.bat"
pip install pywin32

REM Install the service
python "%KMGI_PATH%\src\windows_service.py" install

echo.
echo ============================================
echo Service installed!
echo ============================================
echo.
echo To start the service:
echo   net start KMGIRadioAutomation
echo.
echo To stop the service:
echo   net stop KMGIRadioAutomation
echo.
echo To uninstall:
echo   python src\windows_service.py remove
echo.
echo You can also manage it in Services (services.msc)
echo.
pause
