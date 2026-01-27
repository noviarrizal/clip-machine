import whisper
import subprocess
import os
import datetime

VIRAL_KEYWORDS = [
    "amazing",
    "best",
    "beautiful",
    "awesome",
    "fantastic",
    "great",
    "incredible",
    "perfect",
    "stunning",
    "wonderful"
    "important", "secret", "hack", "advice", "money", "growth", 
    "mistake", "never", "always", "story", "the truth", "failed"
]

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

    # Generate the SRT file for a specific segment
    srt_path = f"output/{job_id}_temp.srt"
    create_srt(result['segments'], srt_path, start, 30)
    
    # FFmpeg with Subtitles
    # Alignment 10 = Centered bottom. 
    # PrimaryColour: &H00FFFFFF is White, &H0000FFFF is Yellow (BGR format)
    subtitle_style = "Alignment=10,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=140"
    
    ffmpeg_cmd = [
        'ffmpeg', '-y', '-ss', str(start), '-t', '30',
        '-i', input_path,
        '-vf', f"crop=ih*(9/16):ih,scale=1080:1920,subtitles={srt_path}:force_style='{subtitle_style}'",
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
        '-c:a', 'aac', output_path
    ]
    subprocess.run(ffmpeg_cmd)

def format_timestamp(seconds: float) -> str:
    td = datetime.timedelta(seconds=seconds)
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    millis = int(td.microseconds / 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"

def create_srt(segments, output_path, start_offset, duration):
    with open(output_path, 'w', encoding='utf-8') as f:
        for i, seg in enumerate(segments):
            # Only include segments within our clip's time range
            if seg['start'] < start_offset: continue
            if seg['start'] > start_offset + duration: break
            
            # Adjust timestamps relative to the start of the clip
            rel_start = max(0, seg['start'] - start_offset)
            rel_end = min(duration, seg['end'] - start_offset)
            
            f.write(f"{i + 1}\n")
            f.write(f"{format_timestamp(rel_start)} --> {format_timestamp(rel_end)}\n")
            f.write(f"{seg['text'].strip().upper()}\n\n") # Upper case looks better for shorts

def score_segments(segments, window_size=30):
    scored_amounts = []

    # Slide through segments to find high-density keyword areas
    for i in range(len(segments)):
        start_time = segments[i]['start']
        end_time = start_time + window_size

        # Calculate score for this 30s window
        score = 0
        text_content = ""
        for j in range(i, len(segments)):
            if segments[j]['start'] > end_time:
                break

            text = segments[j]['text'].lower()
            text_content += " " + text

            # Boost score if viral keywords appear
            for word in VIRAL_KEYWORDS:
                if word in text:
                    score += 10

            # Boost score for shorter, punchier sentences
            if len(segments[j]['text']) < 50:
                score += 2

        scored_momments.append({
            "start": start_time,
            "score": score,
            "text": text_content
        })

    # Sort by score and pick the top 5 (filtering out overlapping ones)
    scored_momments.sort(key=lambda x: x['score'], reverse=True)
    
    top_clips = []
    for momment in scored_momments:
        if any(abs(momment['start'] - existing['start']) < 60 for existing in top_clips):
            continue
        top_clips.append(momment)
        if len(top_clips) >= 5:
            break

    return top_clips
