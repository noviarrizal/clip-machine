import os
import uuid
import asyncio

from fastapi import BackgroundTasks, FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from groq import Groq
from pydantic import BaseModel

# Internal Imports
from processor import download_and_process
from supabase_client import supabase

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

app = FastAPI(title="ClipGen API")

# 1. SETUP CORS (Connects to your Next.js Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. SETUP DIRECTORIES & STATIC SERVING
# This allows you to view videos at http://localhost:8000/output/filename.mp4
os.makedirs("output", exist_ok=True)
app.mount("/output", StaticFiles(directory="output"), name="output")

# 3. DATABASE-BACKED JOB TRACKER
# We use Supabase to persist job status, so restarts don't lose data.
# The old in-memory 'jobs' dictionary is removed.


class ProcessRequest(BaseModel):
    url: str
    license_key: str


# 4. HELPER: LICENSE CHECK
def is_valid_key(key: str) -> bool:
    """Checks if a license key is valid by querying the Supabase 'keys' table."""
    try:
        result = supabase.table("keys").select("key").eq("key", key).execute()
        return len(result.data) > 0
    except Exception as e:
        print(f"Error validating key: {e}")
        return False


# 5. BACKGROUND TASK WRAPPER
def run_job(job_id: str, source: str, is_local: bool = False):
    """The background task that downloads, processes, and updates the job status in Supabase."""
    try:
        # Update status to 'processing'
        supabase.table("jobs").update({"status": "processing"}).eq("job_id", job_id).execute()

        # Run the core logic
        results = download_and_process(source, job_id, is_local)

        # On success, update with 'completed' and the final clips
        supabase.table("jobs").update(
            {
                "status": "completed",
                "clips": results['clips'],
                "transcription": results['transcription'],
            }
        ).eq("job_id", job_id).execute()

    except Exception as e:
        print(f"Error processing job {job_id}: {e}")
        # On failure, update with 'failed' and the error message
        supabase.table("jobs").update({"status": "failed", "error": str(e)}).eq(
            "job_id", job_id
        ).execute()


# 6. API ROUTES


@app.get("/")
def health_check():
    return {"status": "online", "message": "ClipGen Backend Running"}


@app.post("/process")
async def create_task(request: ProcessRequest, background_tasks: BackgroundTasks):
    if not is_valid_key(request.license_key):
        raise HTTPException(status_code=401, detail="Invalid License Key")

    job_id = str(uuid.uuid4())

    # Insert a new job record into Supabase
    try:
        supabase.table("jobs").insert(
            {"job_id": job_id, "status": "pending", "url": request.url}
        ).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create job: {e}")

    background_tasks.add_task(run_job, job_id, request.url, False)
    return {"job_id": job_id}


@app.get("/status/{job_id}")
async def get_status(job_id: str):
    """Retrieves the status of a job from the Supabase 'jobs' table."""
    try:
        result = supabase.table("jobs").select("*").eq("job_id", job_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Job not found")
        return result.data
    except Exception as e:
        # Handle cases where .single() finds no record
        if "PGRST116" in str(e):  # PostgREST code for "exact one row not found"
            raise HTTPException(status_code=404, detail="Job not found")
        raise HTTPException(status_code=500, detail=f"Error fetching job status: {e}")


# 7. NEW: Social Content Generation
class ContentRequest(BaseModel):
    job_id: str


def generate_social_post(transcription: str) -> str:
    """Generates a social media post using Groq based on a transcription."""
    if not transcription:
        return ""

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a viral social media content expert. Your goal is to create a short, punchy, and engaging social media post based on the provided transcription. Use emojis, hashtags, and a conversational tone. The output should be a single block of text, ready to be copy-pasted.",
                },
                {
                    "role": "user",
                    "content": f"Here is the transcription of a video clip: {transcription}",
                },
            ],
            model="llama3-8b-8192",
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        print(f"Error generating social post: {e}")
        return ""


@app.post("/generate-content")
async def generate_content(request: ContentRequest):
    """Generates a social media post from a job's transcription."""
    try:
        # 1. Fetch the job's transcription from Supabase
        result = (
            supabase.table("jobs")
            .select("transcription")
            .eq("job_id", request.job_id)
            .single()
            .execute()
        )
        if not result.data or not result.data.get("transcription"):
            raise HTTPException(status_code=404, detail="Transcription not found for this job.")

        # The transcription is a list of segment objects, so we join the text
        full_transcription = " ".join([seg['text'] for seg in result.data["transcription"]])

        # 2. Generate the social post
        social_post = generate_social_post(full_transcription)
        if not social_post:
            raise HTTPException(status_code=500, detail="Failed to generate social content.")

        return {"social_post": social_post}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")
@app.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, license_key: str = Form(...), file: UploadFile = File(...)):
    if not is_valid_key(license_key):
        raise HTTPException(status_code=401, detail="Invalid License Key")

    job_id = str(uuid.uuid4())

    try:
        ext = os.path.splitext(file.filename)[1] or ".mp4"
        os.makedirs("downloads", exist_ok=True)
        save_path = os.path.abspath(os.path.join("downloads", f"{job_id}{ext}"))
        max_bytes = int(os.environ.get("MAX_UPLOAD_BYTES", 500 * 1024 * 1024))
        if not (file.content_type or "").startswith("video/"):
            raise HTTPException(status_code=400, detail="Unsupported file type")
        size = 0
        with open(save_path, "wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(status_code=413, detail="File too large")
                f.write(chunk)
        supabase.table("jobs").insert({"job_id": job_id, "status": "pending", "url": file.filename}).execute()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create job: {e}")

    background_tasks.add_task(run_job, job_id, save_path, True)
    return {"job_id": job_id}

@app.get("/events/{job_id}")
async def events(job_id: str):
    async def gen():
        try:
            while True:
                result = supabase.table("jobs").select("*").eq("job_id", job_id).single().execute()
                if result.data:
                    yield f"data: {result.data}\n\n"
                    status = result.data.get("status")
                    if status in ("completed", "failed"):
                        break
                await asyncio.sleep(2)
        except Exception:
            yield "event: error\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream")
