"""
processor.py

Core video processing engine for ClipGen.

Pipeline:
  1. Download video (yt-dlp) or accept a local file.
  2. Transcribe audio (Gemini Flash — multimodal, no Whisper needed).
  3. Discover the best viral moments (Gemini Pro — LLM analysis).
  4. Render clips in parallel with FFmpeg using smart face-detection cropping.
"""

import asyncio
import datetime
import json
import os
import subprocess

import cv2
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

MODEL_PRO = "gemini-2.0-pro-exp"      # Best reasoning — viral moment analysis
MODEL_FLASH = "gemini-2.0-flash-lite"  # Fastest — transcription

CLIP_DURATION = 30   # seconds per clip
MAX_CLIPS = 5        # maximum number of clips to extract
MIN_GAP = 60         # minimum seconds between clip start times

# ---------------------------------------------------------------------------
# Stage 1 — Transcription
# ---------------------------------------------------------------------------


async def transcribe_video(video_file) -> list[dict]:
    """
    Asks Gemini Flash to transcribe a video and return structured segments.

    Returns a list of dicts with keys: start (float), end (float), text (str).
    Falls back to a single dummy segment if parsing fails.
    """
    prompt = (
        "Provide the transcription of this video as a JSON list of segments. "
        "Each segment must have these exact keys: 'start' (seconds, float), "
        "'end' (seconds, float), and 'text' (string). "
        "Output ONLY the raw JSON array, no markdown."
    )

    response = await _client.aio.models.generate_content(
        model=MODEL_FLASH,
        contents=[video_file, prompt],
    )

    try:
        clean_json = response.text.strip().lstrip("```json").rstrip("```").strip()
        return json.loads(clean_json)
    except (json.JSONDecodeError, ValueError):
        # Graceful fallback — return the raw text as one segment
        return [{"start": 0.0, "end": CLIP_DURATION, "text": response.text[:300]}]


# ---------------------------------------------------------------------------
# Stage 2 — Viral Moment Discovery
# ---------------------------------------------------------------------------


async def discover_viral_moments(transcription_text: str, segments: list[dict]) -> list[dict]:
    """
    Uses Gemini Pro to identify the most engaging 30-second segments.

    Returns a list of dicts with keys: start (float), reason (str).
    Falls back to the first N segments if the LLM response cannot be parsed.
    """
    prompt = f"""
You are a viral content expert. Analyze the following video transcription and
identify the top {MAX_CLIPS} most engaging, high-impact, or 'viral-worthy'
{CLIP_DURATION}-second segments.

For each segment output:
  - "start": start timestamp in seconds (float)
  - "reason": one sentence explaining why this segment is viral

Rules:
  - Segments must not overlap (at least {MIN_GAP}s between start times).
  - Output ONLY a raw JSON array, no markdown or extra text.

Transcription:
{transcription_text}

Example output:
[{{"start": 12.5, "reason": "Emotional hook about overcoming failure."}}]
"""

    try:
        response = await _client.aio.models.generate_content(
            model=MODEL_PRO,
            contents=prompt,
        )
        clean_json = response.text.strip().lstrip("```json").rstrip("```").strip()
        moments = json.loads(clean_json)

        # Deduplicate — ensure at least MIN_GAP seconds between clips
        unique: list[dict] = []
        for m in moments:
            start = float(m["start"])
            if not any(abs(start - u["start"]) < MIN_GAP for u in unique):
                unique.append({"start": start, "reason": m.get("reason", "")})
            if len(unique) >= MAX_CLIPS:
                break

        return unique

    except (json.JSONDecodeError, ValueError, KeyError) as exc:
        print(f"[processor] Viral moment discovery failed ({exc}), using fallback.")
        return [{"start": float(s["start"]), "reason": "Top segment"} for s in segments[:MAX_CLIPS]]


# ---------------------------------------------------------------------------
# Stage 3 — Subtitle Generation
# ---------------------------------------------------------------------------


def _format_srt_time(seconds: float) -> str:
    """Converts a float number of seconds to SRT timestamp format (HH:MM:SS,ms)."""
    td = datetime.timedelta(seconds=seconds)
    total_sec = int(td.total_seconds())
    millis = int(td.microseconds / 1000)
    hours, remainder = divmod(total_sec, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def _write_srt_file(segments: list[dict], path: str, clip_start: float) -> None:
    """
    Writes an SRT subtitle file for a clip that starts at `clip_start` seconds.
    Timestamps are re-based to be relative to the clip start.
    """
    clip_end = clip_start + CLIP_DURATION
    entry_index = 1

    with open(path, "w", encoding="utf-8") as f:
        for seg in segments:
            if seg["start"] < clip_start:
                continue
            if seg["start"] > clip_end:
                break

            start = max(0.0, seg["start"] - clip_start)
            end = min(float(CLIP_DURATION), seg["end"] - clip_start)

            f.write(f"{entry_index}\n")
            f.write(f"{_format_srt_time(start)} --> {_format_srt_time(end)}\n")
            f.write(f"{seg['text'].strip().upper()}\n\n")
            entry_index += 1


# ---------------------------------------------------------------------------
# Stage 4 — Smart Crop (Face Detection)
# ---------------------------------------------------------------------------


def _get_face_center(video_path: str, start_time: float) -> float:
    """
    Detects the largest face in the frame at `start_time + 1s` and returns
    its horizontal center as a value in [0, 1] (0 = left edge, 1 = right edge).

    Returns 0.5 (center) if no face is detected or the video cannot be read.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return 0.5

    cap.set(cv2.CAP_PROP_POS_MSEC, (start_time + 1) * 1000)
    success, frame = cap.read()
    cap.release()

    if not success:
        return 0.5

    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
    )

    if len(faces) == 0:
        return 0.5

    # Use the largest face as the main subject
    x, _, w, _ = max(faces, key=lambda r: r[2] * r[3])
    return (x + w / 2) / frame.shape[1]


# ---------------------------------------------------------------------------
# Stage 5 — Clip Rendering
# ---------------------------------------------------------------------------


async def _render_clip(
    index: int,
    moment: dict,
    video_path: str,
    job_id: str,
    segments: list[dict],
) -> dict:
    """
    Renders a single 9:16 clip using FFmpeg with:
      - Smart horizontal crop based on face detection.
      - Burned-in subtitles from the SRT file.

    Returns a clip metadata dict.
    """
    clip_name = f"{job_id}_clip_{index}.mp4"
    srt_path = os.path.abspath(f"output/{job_id}_{index}.srt")
    output_path = os.path.abspath(f"output/{clip_name}")

    _write_srt_file(segments, srt_path, moment["start"])

    # Face-aware horizontal crop:
    # The 9:16 crop window is ih*(9/16) wide. We position it so the
    # detected face sits at the centre of the window.
    face_center = _get_face_center(video_path, moment["start"])
    crop_x = f"min(max(0,iw*{face_center}-ih*(9/32)),iw-ih*(9/16))"

    # Escape the SRT path for FFmpeg's subtitles filter
    clean_srt = srt_path.replace("\\", "/").replace(":", "\\:")
    subtitle_filter = (
        f"subtitles='{clean_srt}':force_style='"
        "Fontname=Arial,FontSize=15,Bold=1,"
        "PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,"
        "BorderStyle=1,Outline=2,Alignment=10,MarginV=20'"
    )

    ffmpeg_cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-ss", str(moment["start"]),
        "-t", str(CLIP_DURATION),
        "-i", video_path,
        "-vf", f"crop=ih*(9/16):ih:{crop_x}:0,scale=1080:1920,{subtitle_filter}",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18",
        "-c:a", "aac",
        output_path,
    ]

    process = await asyncio.create_subprocess_exec(*ffmpeg_cmd)
    await process.wait()

    return {
        "id": index,
        "url": f"http://localhost:8000/output/{clip_name}",
        "timestamp": f"{int(moment['start'] // 60)}:{int(moment['start'] % 60):02d}",
        "reason": moment.get("reason", ""),
    }


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


async def download_and_process(
    source: str, job_id: str, is_local: bool = False
) -> dict:
    """
    Full pipeline: download → transcribe → analyse → render clips.

    Args:
        source:   A URL (YouTube, etc.) or a local file path when is_local=True.
        job_id:   Unique identifier used to name output files.
        is_local: Set to True when `source` is already a local file path.

    Returns:
        A dict with keys:
          - "clips": list of clip metadata dicts.
          - "transcription": list of segment dicts from Gemini.
    """
    os.makedirs("downloads", exist_ok=True)
    os.makedirs("output", exist_ok=True)

    # -- Step 1: Obtain the raw video file --
    if is_local:
        raw_video_path = os.path.abspath(source)
    else:
        download_template = os.path.join("downloads", f"{job_id}.%(ext)s")
        subprocess.run(
            ["yt-dlp", "-f", "bestvideo[height<=720]+bestaudio/best", "-o", download_template, source],
            check=True,
        )
        downloaded = [f for f in os.listdir("downloads") if f.startswith(job_id)]
        if not downloaded:
            raise FileNotFoundError(f"yt-dlp did not produce an output file for job {job_id}.")
        raw_video_path = os.path.abspath(os.path.join("downloads", downloaded[0]))
        print(f"[processor] Downloaded → {raw_video_path}")

    # -- Step 2: Upload to Gemini and transcribe --
    print("[processor] Uploading video to Gemini Files API…")
    video_file = _client.files.upload(file=raw_video_path)

    while video_file.state.name == "PROCESSING":
        await asyncio.sleep(2)
        video_file = _client.files.get(name=video_file.name)

    print("[processor] Transcribing with Gemini Flash…")
    segments = await transcribe_video(video_file)

    # -- Step 3: Discover the best viral moments --
    print("[processor] Analysing viral moments with Gemini Pro…")
    transcription_text = " ".join(s["text"] for s in segments)
    moments = await discover_viral_moments(transcription_text, segments)
    print(f"[processor] Found {len(moments)} viral moment(s).")

    # -- Step 4: Render all clips in parallel --
    print("[processor] Rendering clips in parallel…")
    tasks = [_render_clip(i, m, raw_video_path, job_id, segments) for i, m in enumerate(moments)]
    clips = list(await asyncio.gather(*tasks))

    print("[processor] ✨ All clips rendered successfully.")
    return {"clips": clips, "transcription": segments}
