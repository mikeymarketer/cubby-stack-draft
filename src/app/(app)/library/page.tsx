"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Film,
  Upload,
  ChevronDown,
  MoreVertical,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database, SourceVideoStatus } from "@/lib/supabase/types";

type SourceVideoRow = Database["public"]["Tables"]["source_videos"]["Row"];

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const statusConfig: Record<SourceVideoStatus, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  uploaded:   { label: "Queued",     icon: Clock,        className: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  processing: { label: "Processing", icon: Loader2,      className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  ready:      { label: "Ready",      icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  failed:     { label: "Failed",     icon: AlertCircle,  className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function LibraryPage() {
  const [videos, setVideos] = useState<SourceVideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [videosOpen, setVideosOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    let workspaceId: string | null = null;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      const { data: membershipData } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const membership = membershipData as { workspace_id: string } | null;
      if (!membership || cancelled) { setLoading(false); return; }

      workspaceId = membership.workspace_id;

      const { data } = await supabase
        .from("source_videos")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        setVideos((data as SourceVideoRow[] | null) ?? []);
        setLoading(false);
      }

      // Subscribe to realtime changes for this workspace's videos
      const channel = supabase
        .channel("library-videos")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "source_videos",
            filter: `workspace_id=eq.${workspaceId}`,
          },
          (payload) => {
            if (cancelled) return;
            if (payload.eventType === "INSERT") {
              setVideos((prev) => [payload.new as SourceVideoRow, ...prev]);
            } else if (payload.eventType === "UPDATE") {
              setVideos((prev) =>
                prev.map((v) => v.id === payload.new.id ? (payload.new as SourceVideoRow) : v)
              );
            } else if (payload.eventType === "DELETE") {
              setVideos((prev) => prev.filter((v) => v.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }

    const cleanup = load();
    return () => {
      cancelled = true;
      cleanup.then((fn) => fn?.());
    };
  }, []);

  return (
    <>
      <PageHeader title="Video Library">
        <Link href="/upload">
          <Button size="sm" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </Link>
      </PageHeader>

      <div className="space-y-6">
        {/* Source Videos section */}
        <Collapsible open={videosOpen} onOpenChange={setVideosOpen}>
          <div className="mb-2">
            <div className="flex items-center justify-between gap-4 mb-2">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 px-1 py-2 text-left hover:bg-muted/30 rounded-lg transition-colors">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      !videosOpen && "-rotate-90"
                    )}
                  />
                  <h2 className="text-sm font-semibold">Source Videos</h2>
                  {videos.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {videos.length}
                    </Badge>
                  )}
                </button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent>
              <div className="pt-2 pb-4">
                {loading ? (
                  <div className="glass rounded-xl divide-y divide-border">
                    <div className="flex items-center gap-4 px-3 py-2 border-b border-border">
                      <div className="shrink-0 w-12" />
                      <div className="flex-1"><span className="text-xs font-medium text-muted-foreground uppercase">Name</span></div>
                      <div className="hidden sm:block shrink-0 w-[100px]"><span className="text-xs font-medium text-muted-foreground uppercase">Status</span></div>
                      <div className="hidden sm:block shrink-0 w-[70px]"><span className="text-xs font-medium text-muted-foreground uppercase">Duration</span></div>
                      <div className="shrink-0 w-[80px]"><span className="text-xs font-medium text-muted-foreground uppercase">Date</span></div>
                      <div className="shrink-0 w-8" />
                    </div>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-4 px-3 py-2.5">
                        <Skeleton className="h-8 w-12 rounded shrink-0" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                        <Skeleton className="hidden sm:block h-5 w-[80px] rounded-full" />
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
                      title="No source videos yet"
                      description="Upload footage to build your library"
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
                      <div className="hidden sm:block shrink-0 w-[100px]">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</span>
                      </div>
                      <div className="hidden md:block shrink-0 w-[70px]">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</span>
                      </div>
                      <div className="shrink-0 w-[80px]">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</span>
                      </div>
                      <div className="shrink-0 w-8" />
                    </div>

                    {/* Video rows */}
                    {videos.map((v) => {
                      const cfg = statusConfig[v.status];
                      const StatusIcon = cfg.icon;
                      return (
                        <Link
                          key={v.id}
                          href={`/library/${v.id}`}
                          className="flex items-center gap-4 px-3 py-2.5 border-b border-border last:border-0 hover:bg-muted/40 transition-colors duration-100 cursor-pointer group"
                        >
                          {/* Thumbnail */}
                          <div className="h-8 w-12 rounded bg-muted/60 overflow-hidden shrink-0 flex items-center justify-center">
                            <Film className="w-3.5 h-3.5 text-muted-foreground/40" />
                          </div>

                          {/* Name */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-foreground">{v.filename}</p>
                          </div>

                          {/* Status */}
                          <div className="hidden sm:block shrink-0 w-[100px]">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium",
                                cfg.className
                              )}
                            >
                              <StatusIcon className={cn("w-3 h-3", v.status === "processing" && "animate-spin")} />
                              {cfg.label}
                            </span>
                          </div>

                          {/* Duration */}
                          <div className="hidden md:block shrink-0 w-[70px]">
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
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                  className={cn(
                                    "p-1.5 rounded-md transition-colors",
                                    "opacity-0 group-hover:opacity-100 focus:opacity-100",
                                    "hover:bg-muted text-muted-foreground hover:text-foreground"
                                  )}
                                  aria-label="Video actions"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </Link>
                      );
                    })}
                  </>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </div>
    </>
  );
}
