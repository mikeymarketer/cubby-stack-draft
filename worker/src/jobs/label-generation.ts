import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../lib/supabase";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Max transcript characters to send to Claude (stay well under context limits)
const MAX_TRANSCRIPT_CHARS = 60_000;

interface LabelResult {
  name: string;
  start_seconds: number;
  end_seconds: number;
  confidence: number;
}

const SYSTEM_PROMPT = `You are a video content analyzer. Given a transcript with timestamps, identify meaningful labels for scenes, topics, and key moments. Return a JSON array of labels only — no explanation, no markdown.

Each label object must have:
- "name": concise label (2-6 words, title case). Examples: "Product Demo", "Q&A Session", "Technical Deep Dive", "Introduction", "Customer Story"
- "start_seconds": float, start of this segment
- "end_seconds": float, end of this segment
- "confidence": float 0.0–1.0

Rules:
- Cover the full duration with non-overlapping segments
- Prefer meaningful topic/scene labels over generic ones
- 5–20 labels for a typical video; scale with length
- Return only valid JSON, no other text`;

/** Build a compact transcript string for the prompt */
function buildTranscriptText(
  segments: Array<{ start_seconds: number; end_seconds: number; text: string }>
): string {
  return segments
    .map((s) => `[${s.start_seconds.toFixed(1)}s–${s.end_seconds.toFixed(1)}s] ${s.text}`)
    .join("\n")
    .slice(0, MAX_TRANSCRIPT_CHARS);
}

// ─── Main job handler ────────────────────────────────────────────────────────

export async function runLabelGeneration(sourceVideoId: string): Promise<void> {
  // 1. Wait for transcription — we need transcript_segments
  const { data: segments, error: segError } = await supabase
    .from("transcript_segments")
    .select("start_seconds, end_seconds, text")
    .eq("source_video_id", sourceVideoId)
    .order("start_seconds", { ascending: true });

  if (segError) throw new Error(`Failed to fetch segments: ${segError.message}`);
  if (!segments || segments.length === 0) {
    console.warn("[label-gen] No transcript segments found — skipping label generation");
    return;
  }

  // 2. Get workspace_id for the label insert
  const { data: video, error: videoError } = await supabase
    .from("source_videos")
    .select("workspace_id, duration_seconds")
    .eq("id", sourceVideoId)
    .single();

  if (videoError || !video) throw new Error(`Video not found: ${sourceVideoId}`);

  // 3. Build transcript and call Claude
  const transcriptText = buildTranscriptText(segments);
  const totalDuration = video.duration_seconds ?? segments[segments.length - 1].end_seconds;

  console.log(`[label-gen] Sending ${transcriptText.length} chars to Claude...`);

  const message = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Video duration: ${totalDuration.toFixed(1)}s\n\nTranscript:\n${transcriptText}`,
      },
    ],
  });

  const rawText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // 4. Parse the JSON response
  let labels: LabelResult[];
  try {
    // Strip any accidental markdown code fences
    const cleaned = rawText.replace(/^```[a-z]*\n?/m, "").replace(/```\s*$/m, "").trim();
    labels = JSON.parse(cleaned);
    if (!Array.isArray(labels)) throw new Error("Expected array");
  } catch (e) {
    throw new Error(`Failed to parse Claude response as JSON: ${e}.\nResponse was: ${rawText.slice(0, 500)}`);
  }

  if (labels.length === 0) {
    console.warn("[label-gen] Claude returned no labels");
    return;
  }

  // 5. Insert labels
  const labelRows = labels.map((l) => ({
    source_video_id: sourceVideoId,
    workspace_id: video.workspace_id,
    name: l.name,
    confidence: Math.min(1, Math.max(0, l.confidence ?? 0.8)),
    start_timecode: secondsToTimecode(l.start_seconds),
    end_timecode: secondsToTimecode(l.end_seconds),
    start_seconds: l.start_seconds,
    end_seconds: l.end_seconds,
  }));

  const { error: insertError } = await supabase.from("labels").insert(labelRows);
  if (insertError) throw new Error(`Failed to insert labels: ${insertError.message}`);

  console.log(`[label-gen] Done — ${labelRows.length} labels saved`);
}

function secondsToTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}
