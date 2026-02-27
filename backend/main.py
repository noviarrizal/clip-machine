"""
main.py

FastAPI application for ClipGen.

Routes:
  GET  /               — Health check.
  POST /process        — Submit a video URL for processing.
  POST /upload         — Upload a local video file for processing.
  GET  /status/{id}    — Poll job status.
  GET  /events/{id}    — Server-sent events stream for real-time job updates.
  POST /generate-content — Generate a social media post from a completed job.
  GET  /output/{file}  — Serve generated video clips.
"""

import asyncio
import os
import uuid

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from google import genai
from pydantic import BaseModel

from processor import download_and_process
from supabase_client import supabase

load_dotenv()

# ---------------------------------------------------------------------------
# AI client
# ---------------------------------------------------------------------------

_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
_SOCIAL_MODEL = "gemini-2.0-flash-lite"

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="ClipGen API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: restrict to frontend origin in production
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("output", exist_ok=True)
app.mount("/output", StaticFiles(directory="output"), name="output")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", 500 * 1024 * 1024))  # 500 MB

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ProcessRequest(BaseModel):
    url: str
    license_key: str


class ContentRequest(BaseModel):
    job_id: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _is_valid_key(key: str) -> bool:
    """Returns True if the license key exists in the Supabase 'keys' table."""
    try:
        result = supabase.table("keys").select("key").eq("key", key).execute()
        return len(result.data) > 0
    except Exception as exc:
        print(f"[main] License key validation error: {exc}")
        return False


def _update_job_status(job_id: str, **fields) -> None:
    """Convenience wrapper for updating a job row in Supabase."""
    supabase.table("jobs").update(fields).eq("job_id", job_id).execute()


async def _generate_social_post(transcription: str) -> str:
    """
    Generates a ready-to-paste social media caption from a transcription
    using Gemini Flash.

    Returns an empty string on failure.
    """
    if not transcription:
        return ""

    prompt = f"""
You are a viral social media content expert.
Write a short, punchy, engaging post based on this video transcription.
Use emojis and relevant hashtags. Output a single block of text only.

Transcription:
{transcription}
"""
    try:
        response = await _client.aio.models.generate_content(
            model=_SOCIAL_MODEL,
            contents=prompt,
        )
        return response.text
    except Exception as exc:
        print(f"[main] Social post generation error: {exc}")
        return ""


# ---------------------------------------------------------------------------
# Background task
# ---------------------------------------------------------------------------


async def _run_job(job_id: str, source: str, is_local: bool = False) -> None:
    """
    Async background task that runs the full processing pipeline and
    writes status updates to Supabase throughout.
    """
    try:
        _update_job_status(job_id, status="processing")
        results = await download_and_process(source, job_id, is_local)
        _update_job_status(
            job_id,
            status="completed",
            clips=results["clips"],
            transcription=results["transcription"],
        )
    except Exception as exc:
        print(f"[main] Job {job_id} failed: {exc}")
        _update_job_status(job_id, status="failed", error=str(exc))


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/")
def health_check():
    """Returns a simple alive signal."""
    return {"status": "online", "message": "ClipGen Backend Running"}


@app.post("/process")
async def create_task(request: ProcessRequest, background_tasks: BackgroundTasks):
    """Submits a video URL for background processing."""
    if not _is_valid_key(request.license_key):
        raise HTTPException(status_code=401, detail="Invalid license key.")

    job_id = str(uuid.uuid4())

    try:
        supabase.table("jobs").insert(
            {"job_id": job_id, "status": "pending", "url": request.url}
        ).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create job: {exc}")

    background_tasks.add_task(_run_job, job_id, request.url, False)
    return {"job_id": job_id}


@app.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    license_key: str = Form(...),
    file: UploadFile = File(...),
):
    """Accepts a local video file upload and queues it for processing."""
    if not _is_valid_key(license_key):
        raise HTTPException(status_code=401, detail="Invalid license key.")

    if not (file.content_type or "").startswith("video/"):
        raise HTTPException(status_code=400, detail="Unsupported file type. Please upload a video.")

    job_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename or "")[1] or ".mp4"

    os.makedirs("downloads", exist_ok=True)
    save_path = os.path.abspath(os.path.join("downloads", f"{job_id}{ext}"))

    try:
        size = 0
        with open(save_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="File exceeds the 500 MB limit.")
                f.write(chunk)

        supabase.table("jobs").insert(
            {"job_id": job_id, "status": "pending", "url": file.filename}
        ).execute()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {exc}")

    background_tasks.add_task(_run_job, job_id, save_path, True)
    return {"job_id": job_id}


@app.get("/status/{job_id}")
async def get_status(job_id: str):
    """Returns the current status and results (if available) for a job."""
    try:
        result = (
            supabase.table("jobs").select("*").eq("job_id", job_id).single().execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Job not found.")
        return result.data
    except HTTPException:
        raise
    except Exception as exc:
        if "PGRST116" in str(exc):  # PostgREST: row not found
            raise HTTPException(status_code=404, detail="Job not found.")
        raise HTTPException(status_code=500, detail=f"Error fetching job status: {exc}")


@app.get("/events/{job_id}")
async def job_events(job_id: str):
    """
    Server-sent events (SSE) endpoint that streams job status updates
    every 2 seconds until the job completes or fails.
    """
    async def _event_generator():
        try:
            while True:
                result = (
                    supabase.table("jobs").select("*").eq("job_id", job_id).single().execute()
                )
                if result.data:
                    yield f"data: {result.data}\n\n"
                    if result.data.get("status") in ("completed", "failed"):
                        break
                await asyncio.sleep(2)
        except Exception:
            yield "event: error\n\n"

    return StreamingResponse(_event_generator(), media_type="text/event-stream")


@app.post("/generate-content")
async def generate_content(request: ContentRequest):
    """Generates a social media post from a completed job's transcription."""
    try:
        result = (
            supabase.table("jobs")
            .select("transcription")
            .eq("job_id", request.job_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    if not result.data or not result.data.get("transcription"):
        raise HTTPException(status_code=404, detail="Transcription not found for this job.")

    full_transcription = " ".join(seg["text"] for seg in result.data["transcription"])
    social_post = await _generate_social_post(full_transcription)

    if not social_post:
        raise HTTPException(status_code=500, detail="Failed to generate social content.")

    return {"social_post": social_post}
