import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export const loadFFmpeg = async () => {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();
  
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
};

export const extractAudio = async (videoFile: File): Promise<Blob> => {
  const ffmpeg = await loadFFmpeg();
  const inputName = 'input.mp4';
  const outputName = 'output.mp3';

  await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
  
  // Extract audio: -vn (no video), -ab (bitrate), -ar (sample rate)
  await ffmpeg.exec(['-i', inputName, '-vn', '-ab', '128k', '-ar', '44100', '-f', 'mp3', outputName]);

  const data = await ffmpeg.readFile(outputName);
  const arrayBuffer = toArrayBuffer(data);
  return new Blob([arrayBuffer], { type: 'audio/mp3' });
};

export const renderVideo = async (
  videoFile: File | Blob,
  crop: { x: number; y: number; width: number; height: number },
  videoRes: { width: number; height: number },
  displayRes: { width: number; height: number },
  segments: any[]
): Promise<Blob> => {
  const ffmpeg = await loadFFmpeg();
  const inputName = 'input.mp4';
  const outputName = 'output.mp4';
  const srtName = 'subs.srt';

  // 1. Calculate actual crop coordinates
  const scaleX = videoRes.width / displayRes.width;
  const scaleY = videoRes.height / displayRes.height;

  const actualW = Math.floor(crop.width * scaleX);
  const actualH = Math.floor(crop.height * scaleY);
  const actualX = Math.floor(crop.x * scaleX);
  const actualY = Math.floor(crop.y * scaleY);

  // 2. Generate SRT content
  const srtContent = segments
    .map((s, i) => {
      const start = formatSRTTime(s.start);
      const end = formatSRTTime(s.end);
      return `${i + 1}\n${start} --> ${end}\n${s.text.trim()}\n`;
    })
    .join('\n');

  // 3. Write files to FFmpeg virtual FS
  await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
  await ffmpeg.writeFile(srtName, srtContent);

  // 4. Execute Crop + Burn Subtitles
  const vf_ops = [
    `crop=${actualW}:${actualH}:${actualX}:${actualY}`,
    `subtitles=${srtName}:force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00FFFFFF,BorderStyle=1,Outline=1,Shadow=0.5'`
  ];

  try {
    await ffmpeg.exec([
      '-i', inputName,
      '-vf', vf_ops.join(','),
      '-c:a', 'copy',
      outputName
    ]);
  } catch (e) {
    console.error("FFmpeg execution with subtitles failed, falling back to crop-only", e);
    // Fallback to crop-only if subtitle burn fails
    await ffmpeg.exec([
      '-i', inputName,
      '-vf', `crop=${actualW}:${actualH}:${actualX}:${actualY}`,
      '-c:a', 'copy',
      outputName
    ]);
  }

  const data = await ffmpeg.readFile(outputName);
  const arrayBuffer = toArrayBuffer(data);
  return new Blob([arrayBuffer], { type: 'video/mp4' });
};

function formatSRTTime(seconds: number): string {
  const date = new Date(seconds * 1000);
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  const ss = date.getUTCSeconds().toString().padStart(2, '0');
  const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
}

function toArrayBuffer(fileData: unknown): ArrayBuffer {
  if (typeof fileData === 'string') {
    return new TextEncoder().encode(fileData).buffer;
  }
  if (fileData instanceof Uint8Array) {
    const copy = new Uint8Array(fileData.byteLength);
    copy.set(fileData);
    return copy.buffer;
  }
  throw new Error('Unsupported file data type');
}
