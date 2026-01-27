@echo off
echo 🚀 Initializing ClipGen Backend Setup...

:: 1. Create Folders
if not exist downloads mkdir downloads
if not exist output mkdir output

:: 2. Create Keys file
if not exist keys.txt (
    echo DEV-1234 > keys.txt
    echo ✅ Created keys.txt with default key: DEV-1234
)

:: 3. Setup Virtual Environment
python -m venv venv
call venv\Scripts\activate

:: 4. Install Dependencies
python -m pip install --upgrade pip
pip install fastapi uvicorn yt-dlp openai-whisper python-multipart

echo ---
echo ✅ Setup Complete!
echo 👉 Run 'run.bat' to start the server.
pause