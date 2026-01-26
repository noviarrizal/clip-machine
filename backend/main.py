from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uuid
import os
from processor import download_and_process

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

@app.post("/process")
async def start_job(data: dict, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "processing","video_url": None}

    background_tasks.add_task(run_processor, job_id, data['url'])
    return {"job_id": job_id}

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