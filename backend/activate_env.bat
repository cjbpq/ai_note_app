@echo off
cd /d "D:\ai_note_app\backend"
call venv\Scripts\activate
if errorlevel 1 (
    echo Failed to activate virtual environment.
    pause
    exit /b 1
)
echo Virtual environment activated. Launching interactive shell...
cmd /K
