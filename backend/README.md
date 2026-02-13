# ClipGen Backend

A FastAPI-based backend service for automatically generating viral-worthy short-form video clips from long-form content using AI transcription and intelligent moment detection.

## Features

- 🎥 **Automatic Video Processing**: Downloads and processes videos from URLs (YouTube, etc.)
- 🗣️ **AI Transcription**: Uses OpenAI Whisper for accurate speech-to-text
- 🎯 **Viral Moment Detection**: Analyzes content to find the most engaging segments
- 📝 **Auto-Subtitles**: Generates styled SRT subtitles for each clip
- 🔄 **Background Processing**: Asynchronous job processing with status tracking
- 🔐 **License Key Authentication**: Simple key-based access control
- 🗄️ **Supabase Integration**: Ready-to-use database connectivity

## Tech Stack

- **FastAPI** - Modern, fast web framework
- **OpenAI Whisper** - AI-powered transcription
- **yt-dlp** - Video downloading
- **FFmpeg** - Video processing and editing
- **Supabase** - Database and backend services
- **OpenCV** - Face detection for smart cropping

## Prerequisites

- Python 3.8+
- FFmpeg installed and in PATH
- Virtual environment (recommended)

## Installation

### 1. Clone and Navigate

```bash
cd backend
```

### 2. Create Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

### 5. Setup License Keys

Create or edit `keys.txt` with valid license keys (one per line):

```
DEV-1234
PROD-5678
```

## Running the Server

### Development Mode

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

The API will be available at `http://localhost:8000`

## API Documentation

### Health Check

**GET** `/`

Check if the server is running.

**Response:**

```json
{
  "status": "online",
  "message": "ClipGen Backend Running"
}
```

### Create Processing Job

**POST** `/process`

Submit a video URL for processing.

**Request Body:**

```json
{
  "url": "https://youtube.com/watch?v=...",
  "license_key": "DEV-1234"
}
```

**Response:**

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Status Codes:**

- `200` - Job created successfully
- `401` - Invalid license key

### Check Job Status

**GET** `/status/{job_id}`

Get the current status of a processing job.

**Response (Processing):**

```json
{
  "status": "processing",
  "clips": []
}
```

**Response (Completed):**

```json
{
  "status": "completed",
  "clips": [
    {
      "id": 0,
      "url": "http://localhost:8000/output/job-id_clip_0.mp4",
      "timestamp": "2:34"
    }
  ]
}
```

**Response (Failed):**

```json
{
  "status": "failed",
  "error": "Error message here"
}
```

**Status Codes:**

- `200` - Status retrieved
- `404` - Job not found

### Access Generated Clips

**GET** `/output/{filename}`

Directly access generated video clips.

Example: `http://localhost:8000/output/job-id_clip_0.mp4`

## Configuration

Edit `processor.py` to customize:

```python
# Viral keyword detection
VIRAL_KEYWORDS = [
    "amazing", "best", "hack", "advice", "money", "growth",
    "mistake", "never", "always", "story", "the truth", "failed"
]

# Clip settings
CLIP_DURATION = 30  # seconds
MAX_CLIPS = 5       # maximum clips per video
```

## Project Structure

```
backend/
├── main.py                    # FastAPI application & routes
├── processor.py               # Video processing engine
├── supabase_client.py         # Supabase connection
├── test_supabase_connection.py # Connection test script
├── requirements.txt           # Python dependencies
├── .env.example              # Environment variables template
├── .env                      # Your credentials (gitignored)
├── keys.txt                  # License keys (gitignored)
├── downloads/                # Temporary video downloads
└── output/                   # Generated clips & subtitles
```

## Testing Supabase Connection

```bash
python test_supabase_connection.py
```

Expected output:

```
Testing connection to Supabase...
URL: https://your-project.supabase.co
Key present: Yes
Supabase auth check executed...
✅ Connection verified successfully!
```

## How It Works

1. **Download**: Uses `yt-dlp` to download video from URL
2. **Transcribe**: OpenAI Whisper generates accurate transcript
3. **Analyze**: Scores transcript segments based on viral keywords
4. **Extract**: Identifies top moments with non-overlapping timestamps
5. **Process**: FFmpeg crops to 9:16, adds subtitles, exports clips
6. **Serve**: Clips available via HTTP endpoints

## Troubleshooting

### FFmpeg Not Found

Ensure FFmpeg is installed and in your PATH:

```bash
# Windows
ffmpeg -version

# macOS
brew install ffmpeg

# Linux
sudo apt install ffmpeg
```

### Whisper Model Download

First run will download the Whisper model (~140MB for base model). This is normal.

### Port Already in Use

Change the port in the run command:

```bash
uvicorn main:app --port 8001
```

## Development

### Auto-reload on Changes

```bash
uvicorn main:app --reload
```

### View API Documentation

Visit `http://localhost:8000/docs` for interactive Swagger UI

## License

This project uses a license key system. Contact the administrator for valid keys.

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## Support

For issues or questions, please open an issue in the repository.
