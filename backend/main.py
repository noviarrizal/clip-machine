import uuid
import os
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Internal Imports
from processor import download_and_process

app = FastAPI(title="ClipGen API")

# 1. SETUP CORS (Connects to your Next.js Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with your frontend URL
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. SETUP DIRECTORIES & STATIC SERVING
# This allows you to view videos at http://localhost:8000/output/filename.mp4
os.makedirs("output", exist_ok=True)
app.mount("/output", StaticFiles(directory="output"), name="output")

# 3. IN-MEMORY JOB TRACKER (Simplest 'Database' for MVP)
jobs = {}

class ProcessRequest(BaseModel):
    url: str
    license_key: str

# 4. HELPER: LICENSE CHECK
def is_valid_key(key: str) -> bool:
    if not os.path.exists("keys.txt"):
        return False
    with open("keys.txt", "r") as f:
        keys = f.read().splitlines()
    return key in keys

# 5. BACKGROUND TASK WRAPPER
def run_job(job_id: str, url: str):
    try:
        results = download_and_process(url, job_id)
        jobs[job_id] = {"status": "completed", "clips": results}
    except Exception as e:
        print(f"Error processing job {job_id}: {e}")
        jobs[job_id] = {"status": "failed", "error": str(e)}

# 6. API ROUTES

@app.get("/")
def health_check():
    return {"status": "online", "message": "ClipGen Backend Running"}

@app.post("/process")
async def create_task(request: ProcessRequest, background_tasks: BackgroundTasks):
    # Validate License
    if not is_valid_key(request.license_key):
        raise HTTPException(status_code=401, detail="Invalid License Key")
    
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "processing", "clips": []}
    
    # Run the heavy processing in the background so the API stays responsive
    background_tasks.add_task(run_job, job_id, request.url)
    
    return {"job_id": job_id}

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]