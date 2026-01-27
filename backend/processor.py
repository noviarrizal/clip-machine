import whisper
import subprocess
import os

def download_and_process(url: str, job_id: str):
    # 1. Download
    input_path = f"downloads/{job_id}_raw.mp4"
    ydl_command = f"yt-dlp -f 'bestvideo[height<=720]+bestaudio/best' -o {input_path} {url}"
    subprocess.run(ydl_command, shell=True, check=True)
    
    # 2. Transcribe
    model = whisper.load_model("base")
    result = model.transcribe(input_path)
    
    # 3. Logic: Group segments into 5 chunks of ~30 seconds
    segments = result["segments"]
    clips_metadata = []
    
    # Simple strategy: grab 5 distinct parts of the video
    # In a real app, you'd score these based on keywords like "amazing", "important", etc.
    step = max(1, len(segments) // 5)
    for i in range(0, len(segments), step):
        if len(clips_metadata) >= 5: break
    
        start = segments[i]['start']
        end = min(start + 30, segments[-1]['end'])
        
        clip_name = f"{job_id}_clip_{len(clips_metadata)}.mp4"
        output_path = f"output/{clip_name}"
        
        # 4. FFmpeg: Vertical Crop + Simple Subtitle Draw
        # We use a standard 9:16 crop filter
        ffmpeg_cmd = [
            'ffmpeg', '-y', '-ss', str(start), '-t', '30',
            '-i', input_path,
            '-vf', "crop=ih*(9/16):ih,scale=1080:1920",
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
            '-c:a', 'aac', '-shortest', output_path
        ]
        subprocess.run(ffmpeg_cmd)
        clips_metadata.append({
            "id": len(clips_metadata),
            "url": f"http://localhost:8000/output/{clip_name}",
            "timestamp": f"{int(start//60)}:{int(start%60):02d}"
        })
        
        return clips_metadata

