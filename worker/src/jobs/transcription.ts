import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import OpenAI from "openai";
import { supabase } from "../lib/supabase";
import { downloadToTemp, cleanupTemp } from "../lib/storage";

// Point fluent-ffmpeg at the static binary
if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Whisper API limit: 25 MB. We target 23 MB chunks to be safe.
const CHUNK_SIZE_LIMIT = 23 * 1024 * 1024;

/** Convert seconds to HH:MM:SS.mmm timecode */
function toTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return [
    String(h).padStart(2, "0"),
    String(m).padStart(2, "0"),
    `${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`,
  ].join(":");
}

/** Extract audio from a video file to a mono 16kHz MP3 (smallest Whisper-compatible format) */
function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .audioBitrate("32k")
      .format("mp3")
      .on("error", reject)
      .on("end", () => resolve())
      .save(audioPath);
  });
}

/** Get duration of a media file in seconds */
function getMediaDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) reject(err);
      else resolve(meta.format.duration ?? 0);
    });
  });
}

/** Split an audio file into chunks of at most CHUNK_SIZE_LIMIT bytes */
async function splitAudio(audioPath: string, chunkDir: string): Promise<string[]> {
  const stats = fs.statSync(audioPath);
  if (stats.size <= CHUNK_SIZE_LIMIT) return [audioPath];

  const duration = await getMediaDuration(audioPath);
  const ratio = stats.size / duration; // bytes per second
  const chunkDuration = Math.floor(CHUNK_SIZE_LIMIT / ratio) - 5; // subtract 5s buffer

  return new Promise((resolve, reject) => {
    const pattern = path.join(chunkDir, "chunk_%03d.mp3");
    ffmpeg(audioPath)
      .outputOptions([
        "-f segment",
        `-segment_time ${chunkDuration}`,
        "-c copy",
      ])
      .on("error", reject)
      .on("end", () => {
        const chunks = fs.readdirSync(chunkDir)
          .filter((f) => f.startsWith("chunk_") && f.endsWith(".mp3"))
          .sort()
          .map((f) => path.join(chunkDir, f));
        resolve(chunks);
      })
      .save(pattern);
  });
}

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

/** Transcribe a single audio file via Whisper, return segments with optional time offset */
async function transcribeChunk(
  audioPath: string,
  offsetSeconds = 0
): Promise<WhisperSegment[]> {
  const audioStream = fs.createReadStream(audioPath);

  const response = await openai.audio.transcriptions.create({
    file: audioStream,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  // The verbose_json response includes segments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = response as any;
  const segments: WhisperSegment[] = (raw.segments ?? []).map((s: any) => ({
    start: s.start + offsetSeconds,
    end: s.end + offsetSeconds,
    text: (s.text as string).trim(),
  }));

  return segments;
}

// ─── Main job handler ────────────────────────────────────────────────────────

export async function runTranscription(sourceVideoId: string): Promise<void> {
  // 1. Fetch the source video
  const { data: video, error: videoError } = await supabase
    .from("source_videos")
    .select("*")
    .eq("id", sourceVideoId)
    .single();

  if (videoError || !video) {
    throw new Error(`Video not found: ${sourceVideoId}`);
  }

  const tempFiles: string[] = [];
  const chunkDir = fs.mkdtempSync(path.join(os.tmpdir(), "cubby-chunks-"));

  try {
    // 2. Download the video to a temp file
    console.log(`[transcription] Downloading ${video.storage_path}...`);
    const videoPath = await downloadToTemp("source-videos", video.storage_path);
    tempFiles.push(videoPath);

    // 3. Extract audio
    const audioPath = videoPath.replace(/\.[^.]+$/, "") + "-audio.mp3";
    tempFiles.push(audioPath);
    console.log("[transcription] Extracting audio...");
    await extractAudio(videoPath, audioPath);

    // 4. Get video duration and update source_videos
    const durationSeconds = await getMediaDuration(videoPath);
    await supabase
      .from("source_videos")
      .update({ duration_seconds: durationSeconds, updated_at: new Date().toISOString() })
      .eq("id", sourceVideoId);

    // 5. Split into chunks if needed
    console.log("[transcription] Splitting audio if needed...");
    const chunks = await splitAudio(audioPath, chunkDir);
    console.log(`[transcription] ${chunks.length} chunk(s) to transcribe`);

    // 6. Transcribe each chunk, tracking offset for multi-chunk files
    let allSegments: WhisperSegment[] = [];
    let offsetSeconds = 0;

    for (let i = 0; i < chunks.length; i++) {
      console.log(`[transcription] Transcribing chunk ${i + 1}/${chunks.length}...`);
      const chunkDuration = await getMediaDuration(chunks[i]);
      const segments = await transcribeChunk(chunks[i], offsetSeconds);
      allSegments = allSegments.concat(segments);
      offsetSeconds += chunkDuration;
    }

    if (allSegments.length === 0) {
      console.warn("[transcription] No segments returned — video may be silent or unsupported");
      return;
    }

    // 7. Save transcript header
    const { data: transcript, error: transcriptError } = await supabase
      .from("transcripts")
      .insert({ source_video_id: sourceVideoId })
      .select("id")
      .single();

    if (transcriptError || !transcript) {
      throw new Error(`Failed to create transcript: ${transcriptError?.message}`);
    }

    // 8. Insert all segments
    const segmentRows = allSegments
      .filter((s) => s.text.length > 0)
      .map((s) => ({
        transcript_id: transcript.id,
        source_video_id: sourceVideoId,
        start_timecode: toTimecode(s.start),
        end_timecode: toTimecode(s.end),
        start_seconds: s.start,
        end_seconds: s.end,
        text: s.text,
      }));

    const BATCH = 200;
    for (let i = 0; i < segmentRows.length; i += BATCH) {
      const { error } = await supabase
        .from("transcript_segments")
        .insert(segmentRows.slice(i, i + BATCH));
      if (error) throw new Error(`Failed to insert segments: ${error.message}`);
    }

    console.log(`[transcription] Done — ${segmentRows.length} segments saved`);
  } finally {
    cleanupTemp(...tempFiles);
    try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
