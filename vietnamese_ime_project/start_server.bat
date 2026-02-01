@echo off
echo Starting Vietnamese IME Backend Server...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.7 or higher
    pause
    exit /b 1
)

REM Navigate to backend directory
cd /d "%~dp0backend"

REM Check if requirements are installed
echo Checking Python packages...
pip install -r requirements.txt

REM Start the Flask server
echo Starting Flask server on http://localhost:5000
echo.
echo Press Ctrl+C to stop the server
echo.

python testing.py

pause