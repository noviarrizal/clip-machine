#!/bin/bash
# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

if [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
    echo "✅ Virtual Environment Activated"
else
    echo "❌ Error: venv/Scripts/activate not found in $SCRIPT_DIR"
    exit 1
fi

echo "🔥 Starting ClipGen API..."
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload