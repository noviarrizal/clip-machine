import os
import datetime
import subprocess
import whisper
import cv2

# Explicitly add FFmpeg to the PATH for this Python process
ffmpeg_path = r"C:\ffmpeg\bin" # Ensure this matches your actual path
os.environ["PATH"] += os.pathsep + ffmpeg_path

# --- CONFIGURATION ---
VIRAL_KEYWORDS = [
    "amazing", "best", "hack", "advice", "money", "growth", 
    "mistake", "never", "always", "story", "the truth", "failed"
]
CLIP_DURATION = 30  # seconds
MAX_CLIPS = 5

# --- STAGE 1: ANALYSIS HELPERS ---

def get_viral_score(text: str) -> int:
    """Simple scoring based on keyword density."""
    score = 0
    words = text.lower().split()
    for keyword in VIRAL_KEYWORDS:
        if keyword in words:
            score += 10
    if len(text) < 60: # Bonus for short, punchy sentences
        score += 2
    return score

def find_best_moments(segments, count=MAX_CLIPS):
    """Slices transcript into high-value windows."""
    scored_moments = []
    
    for i in range(len(segments)):
        start_time = segments[i]['start']
        end_time = start_time + CLIP_DURATION
        
        # Aggregate text and score for this 30s window
        window_text = ""
        for j in range(i, len(segments)):
            if segments[j]['start'] > end_time:
                break
            window_text += " " + segments[j]['text']
            
        scored_moments.append({
            "start": start_time,
            "score": get_viral_score(window_text)
        })

    # Sort by highest score first
    scored_moments.sort(key=lambda x: x['score'], reverse=True)
    
    # Filter to avoid overlapping clips (ensure at least 1 min gap)
    unique_moments = []
    for m in scored_moments:
        if not any(abs(m['start'] - u['start']) < 60 for u in unique_moments):
            unique_moments.append(m)
        if len(unique_moments) >= count:
            break
            
    return unique_moments

# --- STAGE 2: SUBTITLE GENERATION ---

def format_srt_time(seconds: float) -> str:
    """Converts seconds to HH:MM:SS,ms format for SRT files."""
    td = datetime.timedelta(seconds=seconds)
    total_sec = int(td.total_seconds())
    milli = int(td.microseconds / 1000)
    return f"{total_sec//3600:02d}:{(total_sec%3600)//60:02d}:{total_sec%60:02d},{milli:03d}"

def write_srt_file(segments, path, start_offset):
    """Writes a standard SRT subtitle file for a specific clip."""
    with open(path, 'w', encoding='utf-8') as f:
        for idx, seg in enumerate(segments):
            # Only include text that falls within the 30s window
            if seg['start'] < start_offset: continue
            if seg['start'] > start_offset + CLIP_DURATION: break
            
            # Recalculate time relative to the clip start
            start = max(0, seg['start'] - start_offset)
            end = min(CLIP_DURATION, seg['end'] - start_offset)
            
            f.write(f"{idx + 1}\n")
            f.write(f"{format_srt_time(start)} --> {format_srt_time(end)}\n")
            f.write(f"{seg['text'].strip().upper()}\n\n")

# --- STAGE 3: THE MAIN ENGINE ---

def download_and_process(url: str, job_id: str):
    os.makedirs("downloads", exist_ok=True)
    os.makedirs("output", exist_ok=True)

    print(f"✅ Transcription Complete. Found {len(moments)} viral moments.")

    # 1. Download (We use a template so we KNOW the filename, but allow any extension)
    # This forces yt-dlp to use the job_id as the name but keeps the extension it chooses
    download_template = os.path.join("downloads", f"{job_id}.%(ext)s")
    
    print(f"--- Downloading: {url} ---")
    subprocess.run([
        'yt-dlp', '-f', 'bestvideo[height<=720]+bestaudio/best',
        '-o', download_template, url
    ], check=True)

    # FIND the actual file (since it could be .mp4, .mkv, or .webm)
    downloaded_files = [f for f in os.listdir("downloads") if f.startswith(job_id)]
    if not downloaded_files:
        raise Exception("Download failed, no file found.")
    
    raw_video_path = os.path.abspath(os.path.join("downloads", downloaded_files[0]))
    print(f"✅ Downloaded to: {raw_video_path}")

    # 2. Transcribe
    print("--- Transcribing with Whisper ---")
    model = whisper.load_model("base")
    # We use fp16=False because your log said you are on CPU
    result = model.transcribe(raw_video_path, fp16=False)

    pbar = tqdm(total=len(moments), desc="🎬 Generating Clips", unit="clip")
    
    # 3. Analyze for best moments
    moments = find_best_moments(result['segments'])
    
    final_clips = []
    for i, moment in enumerate(moments):
        clip_name = f"{job_id}_clip_{i}.mp4"
        srt_path = os.path.abspath(f"output/{job_id}_{i}.srt")
        output_path = os.path.abspath(f"output/{clip_name}")
        
        write_srt_file(result['segments'], srt_path, moment['start'])
        clean_srt = srt_path.replace("\\", "/").replace(":", "\\:")
        
        # Viral Subtitle Filter - High Contrast & Centered
        subtitle_filter = (
            f"subtitles='{clean_srt}':force_style='"
            f"Fontname=Arial,FontSize=15,Bold=1,"
            f"PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,"
            f"BorderStyle=1,Outline=2,Alignment=10,MarginV=20'"
        )

        cmd = [
            'ffmpeg', '-y', '-loglevel', 'error', # 'error' hides the messy logs
            '-ss', str(moment['start']), '-t', str(CLIP_DURATION),
            '-i', raw_video_path,
            '-vf', f"crop=ih*(9/16):ih,scale=1080:1920,{subtitle_filter}",
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
            '-c:a', 'aac', output_path
        ]
        
        subprocess.run(cmd, check=True)
        
        final_clips.append({
            "id": i,
            "url": f"http://localhost:8000/output/{clip_name}",
            "timestamp": f"{int(moment['start']//60)}:{int(moment['start']%60):02d}"
        })
        
        pbar.update(1) # Move the progress bar forward
    
    pbar.close()
    print("✨ All clips rendered successfully!")
    return final_clips

def get_face_center(video_path, start_time):
    cap = cv2.VideoCapture(video_path)
    # Jump to 1 second into the clip to find the face
    cap.set(cv2.CAP_PROP_POS_MSEC, (start_time + 1) * 1000)
    success, frame = cap.read()
    cap.release()

    if not success:
        return 0.5  # Default to center if frame read fails

    # Load the face detector
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)

    if len(faces) > 0:
        # Get the first face found: (x, y, width, height)
        (x, y, w, h) = faces[0]
        face_center_x = x + (w / 2)
        # Return as a percentage of the total width
        return face_center_x / frame.shape[1]
    
    return 0.5  # Default to center if no face found