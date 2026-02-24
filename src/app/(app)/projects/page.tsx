"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { TimelineCard } from "@/components/timeline-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderOpen, Plus, Loader2 } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type TimelineRow = Database["public"]["Tables"]["timelines"]["Row"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // New project dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
      setUserId(user.id);

      const { data: membershipData } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const membership = membershipData as { workspace_id: string } | null;
      if (!membership || cancelled) {
        setLoading(false);
        return;
      }
      setWorkspaceId(membership.workspace_id);

      const { data } = await supabase
        .from("timelines")
        .select("*")
        .eq("workspace_id", membership.workspace_id)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        setProjects((data as TimelineRow[] | null) ?? []);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim() || !workspaceId || !userId) return;
    setCreating(true);
    setCreateError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("timelines")
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        title: newTitle.trim(),
      })
      .select()
      .maybeSingle();

    setCreating(false);

    if (error) {
      setCreateError(error.message);
      return;
    }

    if (data) setProjects((prev) => [data as TimelineRow, ...prev]);
    setDialogOpen(false);
    setNewTitle("");
  };

  return (
    <>
      <PageHeader title="Projects">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </PageHeader>

      {loading ? (
        <div
          className="grid w-full"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "16px",
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex flex-col rounded-lg overflow-hidden bg-card border border-border"
            >
              <Skeleton className="w-full" style={{ aspectRatio: "4 / 3" }} />
              <div className="px-3 py-2 space-y-1">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-8 w-8 text-muted-foreground" />}
          title="No projects yet"
          description="Projects let you group usable moments together and export them for editing."
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          }
        />
      ) : (
        <div
          className="grid w-full"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "16px",
          }}
        >
          {projects.map((p) => (
            <TimelineCard
              key={p.id}
              id={p.id}
              title={p.title}
              createdAt={p.created_at}
            />
          ))}
        </div>
      )}

      {/* New Project dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Project name"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            {createError && (
              <p className="text-xs text-destructive">{createError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDialogOpen(false);
                  setNewTitle("");
                  setCreateError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newTitle.trim() || creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
