from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uuid
import os
import asyncio
from processor import download_and_process

process_lock = asyncio.Lock()

app = FastAPI()

# Enable CORS for FE

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store job status in memory for MVP
jobs = {}

def is_key_valid(user_key: str):
    # For MVP: Just check a local text file
    if not os.path.exists("keys.txt"):
        return False
    with open("keys.txt", "r") as f:
        valid_keys = f.read().splitlines()
    return user_key in valid_keys

@app.post("/process")
async def start_job(data: dict, background_tasks: BackgroundTasks):
    # Hard constraint: Check key before burning CPU
    if not is_key_valid(data.get('license_key')):
        return {"status": "error", "message": "Invalid or expired License Key"}
    
    job_id = str(uuid.uuid4())
    # The background task will wait for the lock
    background_tasks.add_task(safe_run_processor, job_id, data['url'])
    return {"job_id": job_id}

async def safe_run_processor(job_id, url):
    async with process_lock: # Only one video at a time!
        run_processor(job_id, url)

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    return jobs.get(job_id, {"status": "not found"})

def run_processor(job_id: str, url: str):
    try:
        output_file = download_and_process(url, job_id)
        jobs[job_id] = {"status": "completed", "video_url": f"http://localhost:8000/output/{job_id}.mp4"}
    except Exception as e:
        jobs[job_id] = {"status": "failed", "error": str(e)}

# Servethe output foldr so FE can play the videos
app.mount("/output", StaticFiles(directory="output"), name="output")