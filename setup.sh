#!/bin/bash
echo "🚀 Initializing ClipGen Backend Setup..."

# 1. Create Folders
mkdir -p downloads output

# 2. Create Keys file if it doesn't exist
if [ ! -f keys.txt ]; then
    echo "DEV-1234" > keys.txt
    echo "✅ Created keys.txt with default key: DEV-1234"
fi

# 3. Setup Virtual Environment
python3 -m venv venv
source venv/bin/activate

# 4. Install Dependencies
pip install --upgrade pip
pip install fastapi uvicorn yt-dlp openai-whisper python-multipart

echo "---"
echo "✅ Setup Complete!"
echo "👉 Run './run.sh' to start the server."