"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Scissors,
  Film,
  FileText,
  Tag,
  Bookmark,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type SourceVideoRow = Database["public"]["Tables"]["source_videos"]["Row"];
type TranscriptSegmentRow = Database["public"]["Tables"]["transcript_segments"]["Row"];
type LabelRow = Database["public"]["Tables"]["labels"]["Row"];
type ClipRow = Database["public"]["Tables"]["clips"]["Row"];

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function toTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export default function VideoPage() {
  const params = useParams<{ videoId: string }>();
  const videoId = params.videoId;
  const searchParams = useSearchParams();
  const initialTime = parseFloat(searchParams.get("t") ?? "0") || 0;

  const videoRef = useRef<HTMLVideoElement>(null);
  const activeSegmentRef = useRef<HTMLButtonElement>(null);

  // Data
  const [video, setVideo] = useState<SourceVideoRow | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegmentRow[]>([]);
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Player state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Clip creation
  const [inPoint, setInPoint] = useState<number | null>(null);
  const [outPoint, setOutPoint] = useState<number | null>(null);
  const [clipTitle, setClipTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedClipId, setSavedClipId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        setUserId(user.id);

        const { data: membershipData } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", user.id)
          .maybeSingle();
        const membership = membershipData as { workspace_id: string } | null;
        if (!membership || cancelled) return;
        const wsId = membership.workspace_id;
        setWorkspaceId(wsId);

        const [videoRes, segRes, labelRes, clipRes] = await Promise.all([
          supabase.from("source_videos").select("*").eq("id", videoId).maybeSingle(),
          supabase
            .from("transcript_segments")
            .select("*")
            .eq("source_video_id", videoId)
            .order("start_seconds"),
          supabase
            .from("labels")
            .select("*")
            .eq("source_video_id", videoId)
            .order("start_seconds"),
          supabase
            .from("clips")
            .select("*")
            .eq("source_video_id", videoId)
            .order("created_at", { ascending: false }),
        ]);

        if (cancelled) return;

        const vid = videoRes.data as SourceVideoRow | null;
        if (!vid) {
          setError("Video not found");
          setLoading(false);
          return;
        }
        setVideo(vid);
        setSegments((segRes.data as TranscriptSegmentRow[] | null) ?? []);
        setLabels((labelRes.data as LabelRow[] | null) ?? []);
        setClips((clipRes.data as ClipRow[] | null) ?? []);

        if (vid.status === "ready") {
          const { data: signedData, error: signErr } = await supabase.storage
            .from("source-videos")
            .createSignedUrl(vid.storage_path, 3600);
          if (!cancelled) {
            if (signErr || !signedData) {
              setError("Could not load video: " + (signErr?.message ?? "unknown"));
            } else {
              setVideoUrl(signedData.signedUrl);
            }
          }
        }

        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // Scroll active transcript segment into view
  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentTime]);

  const seekTo = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    videoRef.current.play().catch(() => {});
  };

  const handleCanPlay = () => {
    if (initialTime > 0 && videoRef.current) {
      videoRef.current.currentTime = initialTime;
    }
  };

  const saveClip = async () => {
    if (
      inPoint === null ||
      outPoint === null ||
      !clipTitle.trim() ||
      !workspaceId ||
      !userId
    )
      return;
    if (outPoint <= inPoint) {
      setSaveError("Out point must be after in point");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSavedClipId(null);

    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("clips")
      .insert({
        source_video_id: videoId,
        workspace_id: workspaceId,
        user_id: userId,
        title: clipTitle.trim(),
        start_timecode: toTimecode(inPoint),
        end_timecode: toTimecode(outPoint),
        start_seconds: inPoint,
        end_seconds: outPoint,
      })
      .select()
      .maybeSingle();

    setSaving(false);

    if (err) {
      setSaveError(err.message);
      return;
    }

    if (data) {
      const clip = data as ClipRow;
      setClips((prev) => [clip, ...prev]);
      setSavedClipId(clip.id);
    }

    setInPoint(null);
    setOutPoint(null);
    setClipTitle("");
    setTimeout(() => setSavedClipId(null), 3000);
  };

  // Active transcript segment highlight
  const activeSegmentId = segments.find(
    (s) => currentTime >= s.start_seconds && currentTime <= s.end_seconds
  )?.id;

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-4 h-[calc(100vh-7rem)] min-h-0">
        <Skeleton className="h-5 w-48" />
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="flex-1 flex flex-col gap-3">
            <Skeleton className="w-full aspect-video rounded-xl" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
          <Skeleton className="w-72 shrink-0 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Link href="/library">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Button>
        </Link>
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-7rem)] min-h-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <Link
          href="/library"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Library
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium text-foreground truncate">
          {video?.filename}
        </span>
      </div>

      {/* Body */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* ── Left: video + clip controls ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto">
          {/* Video */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video w-full shrink-0">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full h-full"
                onTimeUpdate={() => {
                  if (videoRef.current)
                    setCurrentTime(videoRef.current.currentTime);
                }}
                onLoadedMetadata={() => {
                  if (videoRef.current) setDuration(videoRef.current.duration);
                }}
                onCanPlay={handleCanPlay}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
                {video?.status === "processing" ? (
                  <>
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm">Video is still processing…</p>
                  </>
                ) : (
                  <>
                    <Film className="w-8 h-8" />
                    <p className="text-sm">Video unavailable</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Timecode */}
          <div className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
            {formatTime(currentTime)} /{" "}
            {formatTime(duration || video?.duration_seconds || 0)}
          </div>

          {/* ── Clip creation ── */}
          <div className="glass rounded-xl p-4 space-y-3 shrink-0">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Create Clip</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setInPoint(currentTime)}
                className={cn(
                  "flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-colors",
                  inPoint !== null
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  In
                </span>
                <span className="text-xs font-mono tabular-nums mt-0.5">
                  {inPoint !== null ? formatTime(inPoint) : "Click to set"}
                </span>
              </button>

              <button
                onClick={() => setOutPoint(currentTime)}
                className={cn(
                  "flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-colors",
                  outPoint !== null
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  Out
                </span>
                <span className="text-xs font-mono tabular-nums mt-0.5">
                  {outPoint !== null ? formatTime(outPoint) : "Click to set"}
                </span>
              </button>
            </div>

            {inPoint !== null && outPoint !== null && outPoint > inPoint && (
              <p className="text-xs text-muted-foreground">
                Duration:{" "}
                <span className="font-mono text-foreground">
                  {formatTime(outPoint - inPoint)}
                </span>
              </p>
            )}

            <Input
              placeholder="Clip title"
              value={clipTitle}
              onChange={(e) => setClipTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveClip()}
              className="h-8 text-sm"
            />

            {saveError && (
              <p className="text-xs text-destructive">{saveError}</p>
            )}

            {savedClipId && (
              <p className="text-xs text-emerald-400">Clip saved!</p>
            )}

            <Button
              size="sm"
              className="w-full"
              onClick={saveClip}
              disabled={
                inPoint === null ||
                outPoint === null ||
                outPoint <= (inPoint ?? 0) ||
                !clipTitle.trim() ||
                saving
              }
            >
              {saving ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Clip"
              )}
            </Button>
          </div>
        </div>

        {/* ── Right: sidebar tabs ── */}
        <div className="w-72 shrink-0 flex flex-col min-h-0">
          <Tabs defaultValue="transcript" className="flex flex-col h-full gap-2">
            <TabsList className="grid grid-cols-3 w-full shrink-0">
              <TabsTrigger value="transcript" className="text-xs gap-1">
                <FileText className="w-3 h-3" />
                Transcript
              </TabsTrigger>
              <TabsTrigger value="labels" className="text-xs gap-1">
                <Tag className="w-3 h-3" />
                Labels
              </TabsTrigger>
              <TabsTrigger value="clips" className="text-xs gap-1">
                <Bookmark className="w-3 h-3" />
                Clips
                {clips.length > 0 && (
                  <span className="ml-0.5 text-[10px] text-muted-foreground">
                    {clips.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Transcript */}
            <TabsContent
              value="transcript"
              className="flex-1 min-h-0 mt-0 overflow-hidden"
            >
              <ScrollArea className="h-full">
                {segments.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No transcript yet
                  </div>
                ) : (
                  <div className="space-y-0.5 pr-2">
                    {segments.map((seg) => {
                      const isActive = seg.id === activeSegmentId;
                      return (
                        <button
                          key={seg.id}
                          ref={isActive ? activeSegmentRef : null}
                          onClick={() => seekTo(seg.start_seconds)}
                          className={cn(
                            "w-full text-left px-2 py-2 rounded-lg text-xs transition-colors",
                            isActive
                              ? "bg-primary/15 text-foreground"
                              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                          )}
                        >
                          <span className="font-mono text-[10px] text-muted-foreground block mb-0.5">
                            {seg.start_timecode}
                          </span>
                          {seg.text}
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Labels */}
            <TabsContent
              value="labels"
              className="flex-1 min-h-0 mt-0 overflow-hidden"
            >
              <ScrollArea className="h-full">
                {labels.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No labels yet
                  </div>
                ) : (
                  <div className="space-y-1 pr-2">
                    {labels.map((label) => (
                      <button
                        key={label.id}
                        onClick={() => seekTo(label.start_seconds)}
                        className="w-full text-left px-2 py-2.5 rounded-lg text-xs hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="font-medium text-foreground">
                            {label.name}
                          </span>
                          {label.confidence != null && (
                            <span className="text-[10px] text-amber-400 shrink-0">
                              {Math.round(label.confidence * 100)}%
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {label.start_timecode} → {label.end_timecode}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Clips */}
            <TabsContent
              value="clips"
              className="flex-1 min-h-0 mt-0 overflow-hidden"
            >
              <ScrollArea className="h-full">
                {clips.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No clips yet
                  </div>
                ) : (
                  <div className="space-y-1 pr-2">
                    {clips.map((clip) => (
                      <button
                        key={clip.id}
                        onClick={() => seekTo(clip.start_seconds)}
                        className={cn(
                          "w-full text-left px-2 py-2.5 rounded-lg text-xs hover:bg-muted/40 transition-colors",
                          clip.id === savedClipId && "ring-1 ring-emerald-500/40 bg-emerald-500/5"
                        )}
                      >
                        <p className="font-medium text-foreground mb-0.5">
                          {clip.title}
                        </p>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {clip.start_timecode} → {clip.end_timecode}
                        </span>
                        {clip.notes && (
                          <p className="text-muted-foreground mt-0.5 truncate">
                            {clip.notes}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
