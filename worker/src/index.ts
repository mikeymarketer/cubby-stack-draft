import "dotenv/config";
import { supabase } from "./lib/supabase";
import { runJob } from "./jobs/index";
import type { ProcessingJob } from "./types";

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "5000", 10);
const MAX_ATTEMPTS = 3;

// Job type priority — run in this order so label_generation always has a transcript
const JOB_PRIORITY: Record<string, number> = {
  transcription: 0,
  thumbnail_generation: 1,
  label_generation: 2,
  indexing: 3,
  proxy_generation: 4,
};

let isProcessing = false;

async function claimNextJob(): Promise<ProcessingJob | null> {
  // Atomically claim the highest-priority pending job that hasn't exceeded max attempts
  const { data, error } = await supabase
    .from("processing_jobs")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error || !data || data.length === 0) return null;

  // Sort by priority
  const sorted = (data as ProcessingJob[]).sort(
    (a, b) => (JOB_PRIORITY[a.type] ?? 99) - (JOB_PRIORITY[b.type] ?? 99)
  );

  const job = sorted[0];

  // Claim it atomically — only proceed if status is still 'pending'
  const { data: claimed, error: claimError } = await supabase
    .from("processing_jobs")
    .update({
      status: "running",
      attempts: job.attempts + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "pending") // guard against race conditions
    .select()
    .maybeSingle();

  if (claimError || !claimed) return null; // another worker claimed it
  return claimed as ProcessingJob;
}

async function markJobComplete(jobId: string): Promise<void> {
  await supabase
    .from("processing_jobs")
    .update({ status: "complete", error: null, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

async function markJobFailed(jobId: string, errorMessage: string, attempts: number): Promise<void> {
  const finalStatus = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
  await supabase
    .from("processing_jobs")
    .update({
      status: finalStatus,
      error: errorMessage.slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

async function checkAndFinalizeVideo(sourceVideoId: string): Promise<void> {
  // If all jobs for this video are complete, mark the video as ready
  const { data: jobs } = await supabase
    .from("processing_jobs")
    .select("status")
    .eq("source_video_id", sourceVideoId);

  if (!jobs) return;

  const allDone = jobs.every((j) => j.status === "complete");
  const anyFailed = jobs.some((j) => j.status === "failed");

  if (allDone) {
    console.log(`[worker] All jobs complete for ${sourceVideoId} — marking ready`);
    await supabase
      .from("source_videos")
      .update({ status: "ready", updated_at: new Date().toISOString() })
      .eq("id", sourceVideoId);
  } else if (anyFailed) {
    // At least one job permanently failed — mark video as failed
    const { data: pendingJobs } = await supabase
      .from("processing_jobs")
      .select("status")
      .eq("source_video_id", sourceVideoId)
      .in("status", ["pending", "running"]);

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log(`[worker] Job(s) permanently failed for ${sourceVideoId} — marking failed`);
      await supabase
        .from("source_videos")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", sourceVideoId);
    }
  }
}

async function tick(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const job = await claimNextJob();
    if (!job) return;

    console.log(`[worker] Running ${job.type} for video ${job.source_video_id} (attempt ${job.attempts})`);

    try {
      await runJob(job.type, job.source_video_id);
      await markJobComplete(job.id);
      console.log(`[worker] ✓ ${job.type} complete`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[worker] ✗ ${job.type} failed: ${msg}`);
      await markJobFailed(job.id, msg, job.attempts);
    }

    await checkAndFinalizeVideo(job.source_video_id);
  } finally {
    isProcessing = false;
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

console.log(`[worker] CubbyStack worker started (poll: ${POLL_INTERVAL_MS}ms)`);
console.log(`[worker] Supabase: ${process.env.SUPABASE_URL}`);

// Run immediately, then on interval
tick();
const interval = setInterval(tick, POLL_INTERVAL_MS);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[worker] Shutting down...");
  clearInterval(interval);
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("[worker] Shutting down...");
  clearInterval(interval);
  process.exit(0);
});
