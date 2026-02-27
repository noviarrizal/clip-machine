"""
main.py

FastAPI application for ClipGen.

Routes:
  GET  /               — Health check.
  POST /auth/signup    — Register a new user.
  POST /auth/signin    — Authenticate and receive a JWT token.
  POST /process        — Submit a video URL for processing (auth required).
  POST /upload         — Upload a local video file for processing (auth required).
  GET  /status/{id}    — Poll job status (auth required).
  GET  /events/{id}    — Server-sent events stream for real-time job updates.
  POST /generate-content — Generate a social media post from a completed job (auth required).
  GET  /output/{file}  — Serve generated video clips.
"""

import asyncio
import os
import uuid
from datetime import datetime, timedelta

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Security, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from google import genai
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

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


# ---------------------------------------------------------------------------
# Auth configuration
# ---------------------------------------------------------------------------

JWT_SECRET = os.environ.get("JWT_SECRET", "changeme-use-a-strong-secret-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


def _hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> dict:
    """FastAPI dependency — validates the JWT token and returns the user payload."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required.")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class AuthRequest(BaseModel):
    email: str
    password: str


class ProcessRequest(BaseModel):
    url: str
    license_key: str | None = None


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


@app.post("/auth/signup")
def signup(body: AuthRequest):
    """Creates a new user account and returns a JWT token."""
    email = body.email.strip().lower()
    password = body.password

    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    # Check if user already exists
    existing = supabase.table("users").select("id").eq("email", email).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    hashed = _hash_password(password)
    result = supabase.table("users").insert({"email": email, "hashed_password": hashed}).execute()
    user = result.data[0]

    token = _create_token(user["id"], user["email"])
    return {"access_token": token, "token_type": "bearer", "email": user["email"]}


@app.post("/auth/signin")
def signin(body: AuthRequest):
    """Authenticates an existing user and returns a JWT token."""
    email = body.email.strip().lower()

    result = supabase.table("users").select("id, email, hashed_password").eq("email", email).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user = result.data[0]
    if not _verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = _create_token(user["id"], user["email"])
    return {"access_token": token, "token_type": "bearer", "email": user["email"]}


@app.post("/process")
async def create_task(
    request: ProcessRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Submits a video URL for background processing. Requires authentication."""
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
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Accepts a local video file upload and queues it for processing. Requires authentication."""

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
async def get_status(job_id: str, current_user: dict = Depends(get_current_user)):
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
async def generate_content(request: ContentRequest, current_user: dict = Depends(get_current_user)):
    """Generates a social media post from a completed job's transcription."""
    try:
        result = (
            supabase.table("jobs")
            .select("transcription, social_content")
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
