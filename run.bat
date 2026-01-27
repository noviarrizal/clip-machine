@echo off
call venv\Scripts\activate
echo 🔥 Starting ClipGen API on http://localhost:8000
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause