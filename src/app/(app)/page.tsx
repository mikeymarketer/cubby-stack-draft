"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TimelineCard } from "@/components/timeline-card";
import { EmptyState } from "@/components/empty-state";
import { FolderOpen, ChevronDown, Film, Plus, Upload, MoreVertical } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type TimelineRow = Database["public"]["Tables"]["timelines"]["Row"];
type SourceVideoRow = Database["public"]["Tables"]["source_videos"]["Row"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const [timelines, setTimelines] = useState<TimelineRow[]>([]);
  const [videos, setVideos] = useState<SourceVideoRow[]>([]);
  const [timelinesLoading, setTimelinesLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(true);
  const [timelinesOpen, setTimelinesOpen] = useState(true);
  const [videosOpen, setVideosOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: membershipData } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const membership = membershipData as { workspace_id: string } | null;
      if (!membership || cancelled) {
        setTimelinesLoading(false);
        setVideosLoading(false);
        return;
      }

      const [timelinesRes, videosRes] = await Promise.all([
        supabase
          .from("timelines")
          .select("*")
          .eq("workspace_id", membership.workspace_id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("source_videos")
          .select("*")
          .eq("workspace_id", membership.workspace_id)
          .order("created_at", { ascending: false })
          .limit(32),
      ]);

      if (cancelled) return;
      setTimelines((timelinesRes.data as TimelineRow[] | null) ?? []);
      setVideos((videosRes.data as SourceVideoRow[] | null) ?? []);
      setTimelinesLoading(false);
      setVideosLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      {/* Projects section */}
      <Collapsible open={timelinesOpen} onOpenChange={setTimelinesOpen}>
        <div className="mb-2">
          <div className="flex items-center justify-between gap-4 mb-2">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-2 text-left hover:bg-muted/30 rounded-lg transition-colors">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    !timelinesOpen && "-rotate-90"
                  )}
                />
                <h2 className="text-sm font-semibold">Projects</h2>
              </button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <div className="pt-2 pb-4 min-h-[60px]">
              {timelinesLoading ? (
                <div
                  className="grid w-full"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px" }}
                >
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex flex-col rounded-lg overflow-hidden bg-card border border-border max-w-[220px]">
                      <Skeleton className="w-full" style={{ aspectRatio: "16 / 9" }} />
                      <div className="px-2 py-1.5 space-y-1">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-2 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : timelines.length === 0 ? (
                <div className="glass rounded-xl p-6">
                  <EmptyState
                    icon={<FolderOpen className="h-8 w-8 text-muted-foreground" />}
                    title="No projects yet"
                    description="Create a project to start assembling your usable moments"
                    action={
                      <Link href="/projects">
                        <Button size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          New Project
                        </Button>
                      </Link>
                    }
                  />
                </div>
              ) : (
                <div
                  className="grid w-full"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "16px" }}
                >
                  {timelines.map((t) => (
                    <TimelineCard
                      key={t.id}
                      id={t.id}
                      title={t.title}
                      createdAt={t.created_at}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Recent uploads section */}
      <Collapsible open={videosOpen} onOpenChange={setVideosOpen}>
        <div className="mb-2">
          <div className="flex items-center justify-between gap-4 mb-2">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-2 text-left hover:bg-muted/30 rounded-lg transition-colors">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    !videosOpen && "-rotate-90"
                  )}
                />
                <h2 className="text-sm font-semibold">Suggested videos</h2>
              </button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <div className="pt-2 pb-4 relative">
              {videosLoading ? (
                <div className="glass rounded-xl divide-y divide-border">
                  <div className="flex items-center gap-4 px-3 py-2 border-b border-border">
                    <div className="shrink-0 w-12" />
                    <div className="flex-1"><span className="text-xs font-medium text-muted-foreground uppercase">Name</span></div>
                    <div className="hidden sm:block shrink-0 w-[70px]"><span className="text-xs font-medium text-muted-foreground uppercase">Duration</span></div>
                    <div className="shrink-0 w-[80px]"><span className="text-xs font-medium text-muted-foreground uppercase">Date</span></div>
                    <div className="shrink-0 w-8" />
                  </div>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-3 py-2.5">
                      <Skeleton className="h-8 w-12 rounded shrink-0" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="hidden sm:block h-4 w-[50px]" />
                      <Skeleton className="h-4 w-[60px]" />
                      <div className="w-8" />
                    </div>
                  ))}
                </div>
              ) : videos.length === 0 ? (
                <div className="glass rounded-xl p-6">
                  <EmptyState
                    icon={<Film className="h-8 w-8 text-muted-foreground" />}
                    title="No videos yet"
                    description="Upload your first source video to get started"
                    action={
                      <Link href="/upload">
                        <Button size="sm">
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Video
                        </Button>
                      </Link>
                    }
                  />
                </div>
              ) : (
                <>
                  {/* Header row */}
                  <div className="flex items-center gap-4 px-3 py-2 border-b border-border">
                    <div className="shrink-0 w-12" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</span>
                    </div>
                    <div className="hidden sm:block shrink-0 w-[70px]">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</span>
                    </div>
                    <div className="shrink-0 w-[80px]">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</span>
                    </div>
                    <div className="shrink-0 w-8" />
                  </div>

                  {/* Video rows */}
                  {videos.map((v) => (
                    <Link
                      key={v.id}
                      href={`/library/${v.id}`}
                      className="flex items-center gap-4 px-3 py-2.5 border-b border-border last:border-0 hover:bg-muted/40 transition-colors group cursor-pointer"
                    >
                      {/* Thumbnail */}
                      <div className="h-8 w-12 rounded bg-muted/60 overflow-hidden shrink-0 flex items-center justify-center">
                        <Film className="w-3.5 h-3.5 text-muted-foreground/40" />
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">{v.filename}</p>
                      </div>

                      {/* Duration */}
                      <div className="hidden sm:block shrink-0 w-[70px]">
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {formatDuration(v.duration_seconds)}
                        </span>
                      </div>

                      {/* Date */}
                      <div className="shrink-0 w-[80px]">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(v.created_at)}
                        </span>
                      </div>

                      {/* Menu */}
                      <div className="shrink-0 w-8 flex justify-center">
                        <button
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                          aria-label="More actions"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </Link>
                  ))}
                </>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
