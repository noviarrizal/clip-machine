import os
import datetime
import subprocess
import whisper

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
    """Main workflow: Download -> Transcribe -> Analyze -> Export."""
    
    # Setup workspace
    os.makedirs("downloads", exist_ok=True)
    os.makedirs("output", exist_ok=True)
    
    raw_video = os.path.abspath(f"downloads/{job_id}.mp4")
    
    # 1. Download source
    subprocess.run([
        'yt-dlp', '-f', 'bestvideo[height<=720]+bestaudio/best',
        '-o', raw_video, url
    ], check=True)
    
    # 2. Transcribe
    model = whisper.load_model("base")
    result = model.transcribe(raw_video)
    
    # 3. Analyze for best moments
    moments = find_best_moments(result['segments'])
    
    final_clips = []
    
    # 4. Generate clips
    for i, moment in enumerate(moments):
        clip_name = f"{job_id}_clip_{i}.mp4"
        srt_path = os.path.abspath(f"output/{job_id}_{i}.srt")
        output_path = os.path.abspath(f"output/{clip_name}")
        
        write_srt_file(result['segments'], srt_path, moment['start'])
        
        # Path escaping for FFmpeg 'subtitles' filter
        clean_srt = srt_path.replace("\\", "/").replace(":", "\\:")
        
        # Build FFmpeg command (Vertical crop + Burn Subtitles)
        cmd = [
            'ffmpeg', '-y', 
            '-ss', str(moment['start']), '-t', str(CLIP_DURATION),
            '-i', raw_video,
            '-vf', f"crop=ih*(9/16):ih,scale=1080:1920,subtitles='{clean_srt}':force_style='Alignment=10,FontSize=22'",
            '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', output_path
        ]
        
        subprocess.run(cmd, check=True)
        
        final_clips.append({
            "id": i,
            "url": f"http://localhost:8000/output/{clip_name}",
            "timestamp": f"{int(moment['start']//60)}:{int(moment['start']%60):02d}"
        })
        
    return final_clips