"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Download,
  Plus,
  Scissors,
  Film,
  GripVertical,
  Trash2,
  Loader2,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type TimelineRow = Database["public"]["Tables"]["timelines"]["Row"];
type TimelineEventRow = Database["public"]["Tables"]["timeline_events"]["Row"];
type ClipRow = Database["public"]["Tables"]["clips"]["Row"];
type SourceVideoRow = Database["public"]["Tables"]["source_videos"]["Row"];

interface EventWithClip extends TimelineEventRow {
  clip: ClipRow & { video_filename: string };
}

interface ClipWithVideo extends ClipRow {
  video_filename: string;
}

// ─── EDL generation ──────────────────────────────────────────────────────────

function secondsToSMPTE(seconds: number, fps: number): string {
  const rounded = fps === 29.97 ? fps : Math.round(fps) || 24;
  const totalFrames = Math.round(seconds * rounded);
  const h = Math.floor(totalFrames / (3600 * rounded));
  const m = Math.floor((totalFrames % (3600 * rounded)) / (60 * rounded));
  const s = Math.floor((totalFrames % (60 * rounded)) / rounded);
  const f = totalFrames % rounded;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}

function generateEDL(title: string, events: EventWithClip[], videoMap: Record<string, SourceVideoRow>): string {
  const lines: string[] = [
    `TITLE: ${title}`,
    `FCM: NON-DROP FRAME`,
    ``,
  ];

  let recCursor = 0;

  events.forEach((ev, idx) => {
    const clip = ev.clip;
    const video = videoMap[clip.source_video_id];
    const fps = video?.fps ?? 24;
    const srcIn = secondsToSMPTE(clip.start_seconds, fps);
    const srcOut = secondsToSMPTE(clip.end_seconds, fps);
    const duration = clip.end_seconds - clip.start_seconds;
    const recIn = secondsToSMPTE(recCursor, fps);
    const recOut = secondsToSMPTE(recCursor + duration, fps);
    recCursor += duration;

    // Reel name: first 8 chars of source video filename (no extension), padded
    const rawName = (video?.filename ?? "UNKNOWN").replace(/\.[^.]+$/, "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const reelName = (rawName || "AX").slice(0, 8).padEnd(8, " ");

    const eventNum = String(idx + 1).padStart(3, "0");
    lines.push(`${eventNum}  ${reelName} V     C        ${srcIn} ${srcOut} ${recIn} ${recOut}`);
    lines.push(`* FROM CLIP NAME: ${clip.title}`);
    lines.push(``);
  });

  return lines.join("\n");
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Duration helper ──────────────────────────────────────────────────────────

function formatDuration(start: number, end: number): string {
  const secs = Math.round(end - start);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Components ───────────────────────────────────────────────────────────────

function EventRow({
  ev,
  index,
  onRemove,
}: {
  ev: EventWithClip;
  index: number;
  onRemove: (id: string) => void;
}) {
  const clip = ev.clip;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-card border border-border rounded-lg group">
      {/* Drag handle (visual only for now) */}
      <GripVertical className="w-4 h-4 text-muted-foreground/30 shrink-0 cursor-grab" />

      {/* Position number */}
      <span className="text-xs font-mono text-muted-foreground/50 w-5 shrink-0 text-right">
        {index + 1}
      </span>

      {/* Clip thumbnail placeholder */}
      <div className="h-8 w-12 rounded bg-muted/50 shrink-0 flex items-center justify-center">
        <Scissors className="w-3 h-3 text-muted-foreground/40" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{clip.title}</p>
        <div className="flex items-center gap-1.5">
          <Film className="w-3 h-3 text-muted-foreground/50 shrink-0" />
          <p className="text-xs text-muted-foreground truncate">{clip.video_filename}</p>
        </div>
      </div>

      {/* Timecode + duration */}
      <div className="text-right shrink-0">
        <p className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {clip.start_timecode} → {clip.end_timecode}
        </p>
        <p className="text-[10px] text-muted-foreground/60">
          {formatDuration(clip.start_seconds, clip.end_seconds)}
        </p>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(ev.id)}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
        aria-label="Remove from project"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<TimelineRow | null>(null);
  const [events, setEvents] = useState<EventWithClip[]>([]);
  const [videoMap, setVideoMap] = useState<Record<string, SourceVideoRow>>({});
  const [allClips, setAllClips] = useState<ClipWithVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add-clips dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) { setError("Not authenticated"); setLoading(false); return; }

      const { data: membershipData } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const membership = membershipData as { workspace_id: string } | null;
      if (!membership) { setError("No workspace"); setLoading(false); return; }
      const wsId = membership.workspace_id;

      // Load project, events, all clips, all source videos in parallel
      const [projRes, eventsRes, clipsRes, videosRes] = await Promise.all([
        supabase.from("timelines").select("*").eq("id", projectId).maybeSingle(),
        supabase.from("timeline_events").select("*").eq("timeline_id", projectId).order("position"),
        supabase.from("clips").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false }),
        supabase.from("source_videos").select("*").eq("workspace_id", wsId),
      ]);

      const proj = projRes.data as TimelineRow | null;
      if (!proj) { setError("Project not found"); setLoading(false); return; }
      setProject(proj);

      const vids = (videosRes.data as SourceVideoRow[] | null) ?? [];
      const vMap = Object.fromEntries(vids.map((v) => [v.id, v]));
      setVideoMap(vMap);

      const clips = (clipsRes.data as ClipRow[] | null) ?? [];
      const clipsWithVideo: ClipWithVideo[] = clips.map((c) => ({
        ...c,
        video_filename: vMap[c.source_video_id]?.filename ?? "Unknown",
      }));
      setAllClips(clipsWithVideo);

      const rawEvents = (eventsRes.data as TimelineEventRow[] | null) ?? [];
      const clipMap = Object.fromEntries(clips.map((c) => [c.id, c]));
      const eventsWithClips: EventWithClip[] = rawEvents
        .map((ev) => {
          const clip = clipMap[ev.clip_id];
          if (!clip) return null;
          return {
            ...ev,
            clip: { ...clip, video_filename: vMap[clip.source_video_id]?.filename ?? "Unknown" },
          };
        })
        .filter(Boolean) as EventWithClip[];
      setEvents(eventsWithClips);

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const alreadyInProject = new Set(events.map((e) => e.clip_id));

  const handleAddClips = async () => {
    if (selected.size === 0) return;
    setAdding(true);

    const supabase = createClient();
    const nextPosition = events.length;

    // Build record timeline: cumulative from end of existing events
    let recCursor = events.reduce((acc, ev) => {
      const clip = ev.clip;
      return acc + (clip.end_seconds - clip.start_seconds);
    }, 0);

    const toInsert = Array.from(selected).map((clipId, i) => {
      const clip = allClips.find((c) => c.id === clipId)!;
      const duration = clip.end_seconds - clip.start_seconds;
      const recIn = recCursor;
      recCursor += duration;

      // Convert seconds to HH:MM:SS.mmm timecode
      const toTC = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        const ms = Math.round((s % 1) * 1000);
        return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}.${String(ms).padStart(3,"0")}`;
      };

      return {
        timeline_id: projectId,
        clip_id: clipId,
        position: nextPosition + i,
        record_start_timecode: toTC(recIn),
        record_end_timecode: toTC(recCursor),
        record_start_seconds: recIn,
        record_end_seconds: recCursor,
      };
    });

    const { error: insertErr } = await supabase.from("timeline_events").insert(toInsert);
    setAdding(false);

    if (!insertErr) {
      setSelected(new Set());
      setDialogOpen(false);
      await load(); // refresh
    }
  };

  const handleRemoveEvent = async (eventId: string) => {
    const supabase = createClient();
    await supabase.from("timeline_events").delete().eq("id", eventId);
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  const handleExportEDL = () => {
    if (!project) return;
    const edl = generateEDL(project.title, events, videoMap);
    const safeName = project.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    downloadText(`${safeName}.edl`, edl);
  };

  // ── Total duration ────────────────────────────────────────────────────────
  const totalSeconds = events.reduce(
    (acc, ev) => acc + (ev.clip.end_seconds - ev.clip.start_seconds),
    0
  );
  const totalDisplay = formatDuration(0, totalSeconds);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-56" />
        <div className="space-y-2 mt-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Link href="/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <Link
          href="/projects"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Projects
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium text-foreground truncate">{project?.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <FolderOpen className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">{project?.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {events.length} clip{events.length !== 1 ? "s" : ""}
            {events.length > 0 && ` · ${totalDisplay} total`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportEDL}
            disabled={events.length === 0}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export EDL
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Clips
          </Button>
        </div>
      </div>

      {/* Clip list */}
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Scissors className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">No clips yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Add usable moments to this project to build your select
          </p>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Clips
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {events.map((ev, idx) => (
            <EventRow
              key={ev.id}
              ev={ev}
              index={idx}
              onRemove={handleRemoveEvent}
            />
          ))}

          {/* Total bar */}
          <div className="flex items-center justify-between px-3 py-2 mt-2 rounded-lg bg-muted/30 border border-border/50">
            <span className="text-xs text-muted-foreground">
              Total duration
            </span>
            <span className="text-xs font-mono font-medium text-foreground">
              {totalDisplay}
            </span>
          </div>
        </div>
      )}

      {/* ── Add Clips dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Usable Moments</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            {allClips.filter((c) => !alreadyInProject.has(c.id)).length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {allClips.length === 0
                  ? "No usable moments yet. Go to Library → open a video → mark In/Out points."
                  : "All your clips are already in this project."}
              </div>
            ) : (
              <ScrollArea className="max-h-96">
                <div className="space-y-1 pr-2">
                  {allClips
                    .filter((c) => !alreadyInProject.has(c.id))
                    .map((clip) => {
                      const isSelected = selected.has(clip.id);
                      return (
                        <button
                          key={clip.id}
                          onClick={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(clip.id)) next.delete(clip.id);
                              else next.add(clip.id);
                              return next;
                            })
                          }
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
                            isSelected
                              ? "border-primary/50 bg-primary/10"
                              : "border-border hover:border-primary/30 hover:bg-muted/40"
                          )}
                        >
                          {/* Checkbox */}
                          <div
                            className={cn(
                              "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                              isSelected
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/40"
                            )}
                          >
                            {isSelected && (
                              <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 10 8">
                                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{clip.title}</p>
                            <div className="flex items-center gap-1">
                              <Film className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                              <p className="text-xs text-muted-foreground truncate">{clip.video_filename}</p>
                            </div>
                          </div>

                          <span className="text-xs text-muted-foreground font-mono shrink-0">
                            {formatDuration(clip.start_seconds, clip.end_seconds)}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </ScrollArea>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                {selected.size > 0 ? `${selected.size} selected` : ""}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setDialogOpen(false); setSelected(new Set()); }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddClips}
                  disabled={selected.size === 0 || adding}
                >
                  {adding ? (
                    <><Loader2 className="w-3 h-3 mr-2 animate-spin" />Adding…</>
                  ) : (
                    `Add ${selected.size > 0 ? selected.size : ""} Clip${selected.size !== 1 ? "s" : ""}`
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
