"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { TimelineCard } from "@/components/timeline-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Layers, Plus } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type TimelineRow = Database["public"]["Tables"]["timelines"]["Row"];

export default function TimelinesPage() {
  const [timelines, setTimelines] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

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

      const { data } = await supabase
        .from("timelines")
        .select("*")
        .eq("workspace_id", membership.workspace_id)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        setTimelines((data as TimelineRow[] | null) ?? []);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <PageHeader title="Timelines">
        <Button size="sm" disabled>
          <Plus className="h-4 w-4 mr-2" />
          New Timeline
        </Button>
      </PageHeader>

      {loading ? (
        <div
          className="grid w-full"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "16px" }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex flex-col rounded-lg overflow-hidden bg-card border border-border">
              <Skeleton className="w-full" style={{ aspectRatio: "4 / 3" }} />
              <div className="px-3 py-2 space-y-1">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : timelines.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-8 w-8 text-muted-foreground" />}
          title="No timelines yet"
          description="Timelines let you assemble clips into ordered selects. Start by searching your footage."
        />
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
            />
          ))}
        </div>
      )}
    </>
  );
}
