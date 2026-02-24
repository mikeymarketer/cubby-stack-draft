"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Scissors, Film } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type ClipRow = Database["public"]["Tables"]["clips"]["Row"];
type SourceVideoRow = Database["public"]["Tables"]["source_videos"]["Row"];

interface ClipWithVideo extends ClipRow {
  video_filename: string;
}

function formatDuration(start: number, end: number): string {
  const secs = Math.round(end - start);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function ClipCard({ clip }: { clip: ClipWithVideo }) {
  const duration = formatDuration(clip.start_seconds, clip.end_seconds);

  return (
    <Link
      href={`/library/${clip.source_video_id}?t=${Math.floor(clip.start_seconds)}`}
      className="flex flex-col rounded-xl overflow-hidden bg-card border border-border hover:border-primary/40 transition-colors group"
    >
      {/* Thumbnail area */}
      <div className="relative w-full bg-muted/50 flex items-center justify-center" style={{ aspectRatio: "16 / 9" }}>
        <Scissors className="w-6 h-6 text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors" />
        {/* Duration badge */}
        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono font-medium tabular-nums">
          {duration}
        </span>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5 space-y-1">
        <p className="text-sm font-medium text-foreground truncate leading-tight">
          {clip.title}
        </p>
        <div className="flex items-center gap-1 min-w-0">
          <Film className="w-3 h-3 text-muted-foreground/60 shrink-0" />
          <p className="text-xs text-muted-foreground truncate">
            {clip.video_filename}
          </p>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground/70 tabular-nums">
          {clip.start_timecode} → {clip.end_timecode}
        </p>
      </div>
    </Link>
  );
}

function ClipCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl overflow-hidden bg-card border border-border">
      <Skeleton className="w-full" style={{ aspectRatio: "16 / 9" }} />
      <div className="px-3 py-2.5 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-2.5 w-2/3" />
      </div>
    </div>
  );
}

export default function UsableMomentsPage() {
  const [clips, setClips] = useState<ClipWithVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      const { data: membershipData } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const membership = membershipData as { workspace_id: string } | null;
      if (!membership || cancelled) {
        setLoading(false);
        return;
      }

      const wsId = membership.workspace_id;

      // Fetch clips + source video filenames in parallel
      const [clipsRes, videosRes] = await Promise.all([
        supabase
          .from("clips")
          .select("*")
          .eq("workspace_id", wsId)
          .order("created_at", { ascending: false }),
        supabase
          .from("source_videos")
          .select("id, filename")
          .eq("workspace_id", wsId),
      ]);

      if (cancelled) return;

      const videoMap = Object.fromEntries(
        ((videosRes.data as Pick<SourceVideoRow, "id" | "filename">[] | null) ?? []).map(
          (v) => [v.id, v.filename]
        )
      );

      const clipsWithVideo: ClipWithVideo[] = (
        (clipsRes.data as ClipRow[] | null) ?? []
      ).map((c) => ({
        ...c,
        video_filename: videoMap[c.source_video_id] ?? "Unknown",
      }));

      setClips(clipsWithVideo);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader title="Usable Moments">
        <span className="text-sm text-muted-foreground">
          {!loading && clips.length > 0 && `${clips.length} clip${clips.length !== 1 ? "s" : ""}`}
        </span>
      </PageHeader>

      {loading ? (
        <div
          className="grid w-full"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "16px",
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <ClipCardSkeleton key={i} />
          ))}
        </div>
      ) : clips.length === 0 ? (
        <EmptyState
          icon={<Scissors className="h-8 w-8 text-muted-foreground" />}
          title="No usable moments yet"
          description="Open a video in the Library, mark an in and out point, and save a clip."
        />
      ) : (
        <div
          className={cn("grid w-full")}
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "16px",
          }}
        >
          {clips.map((clip) => (
            <ClipCard key={clip.id} clip={clip} />
          ))}
        </div>
      )}
    </>
  );
}
