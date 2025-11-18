@echo off
cd /d "D:\ai_note_app\backend"
call venv\Scripts\activate
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000