"use client";

import { useState } from "react";
import { Search, Clock, Film, ArrowRight, Sparkles, FileText, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const suggestions = [
  "someone explaining the product on camera",
  "outdoor b-roll with natural light",
  "interview with emotional moment",
  "team celebrating a win",
];

interface SearchResult {
  id: string;
  source_video_id: string;
  video_filename: string;
  start_timecode: string;
  end_timecode: string;
  start_seconds: number;
  text: string;
  kind: "transcript" | "label";
  confidence?: number | null;
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/25 text-primary rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function groupByVideo(results: SearchResult[]) {
  const map = new Map<string, { filename: string; items: SearchResult[] }>();
  for (const r of results) {
    if (!map.has(r.source_video_id)) {
      map.set(r.source_video_id, { filename: r.video_filename, items: [] });
    }
    map.get(r.source_video_id)!.items.push(r);
  }
  return Array.from(map.entries()).map(([id, val]) => ({ videoId: id, ...val }));
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setLastQuery(q);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!membership) throw new Error("No workspace");
      const workspaceId = membership.workspace_id;

      // All ready videos for this workspace
      const { data: videos } = await supabase
        .from("source_videos")
        .select("id, filename")
        .eq("workspace_id", workspaceId)
        .eq("status", "ready");

      const videoIds = (videos ?? []).map((v) => v.id);
      const videoMap = Object.fromEntries(
        (videos ?? []).map((v) => [v.id, v.filename])
      );

      if (videoIds.length === 0) {
        setResults([]);
        return;
      }

      const [segRes, labelRes] = await Promise.all([
        supabase
          .from("transcript_segments")
          .select(
            "id, source_video_id, start_timecode, end_timecode, start_seconds, text"
          )
          .in("source_video_id", videoIds)
          .ilike("text", `%${q}%`)
          .limit(30),
        supabase
          .from("labels")
          .select(
            "id, source_video_id, name, confidence, start_timecode, end_timecode, start_seconds"
          )
          .eq("workspace_id", workspaceId)
          .ilike("name", `%${q}%`)
          .limit(15),
      ]);

      if (segRes.error) throw new Error(segRes.error.message);
      if (labelRes.error) throw new Error(labelRes.error.message);

      const segmentResults: SearchResult[] = (segRes.data ?? []).map((s) => ({
        id: s.id,
        source_video_id: s.source_video_id,
        video_filename: videoMap[s.source_video_id] ?? "Unknown",
        start_timecode: s.start_timecode,
        end_timecode: s.end_timecode,
        start_seconds: s.start_seconds,
        text: s.text,
        kind: "transcript",
      }));

      const labelResults: SearchResult[] = (labelRes.data ?? []).map((l) => ({
        id: l.id,
        source_video_id: l.source_video_id,
        video_filename: videoMap[l.source_video_id] ?? "Unknown",
        start_timecode: l.start_timecode,
        end_timecode: l.end_timecode,
        start_seconds: l.start_seconds,
        text: l.name,
        kind: "label",
        confidence: l.confidence,
      }));

      // Labels first (higher signal), then transcript hits, sorted by time within each video
      const combined = [...labelResults, ...segmentResults].sort(
        (a, b) =>
          a.source_video_id.localeCompare(b.source_video_id) ||
          a.start_seconds - b.start_seconds
      );

      setResults(combined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  const groups = results ? groupByVideo(results) : [];

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Search</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Find moments in your footage by transcript or label
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
            focused
              ? "border-primary/50 bg-card shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
              : "border-border bg-card"
          )}
        >
          <Sparkles className="w-5 h-5 text-primary shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Describe a moment, person, place, or feeling..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-30 disabled:pointer-events-none text-primary-foreground transition-colors shrink-0"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Suggestions — only when no results yet */}
      {results === null && !loading && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Try searching for
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setQuery(s);
                  runSearch(s);
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/40 text-left transition-colors group"
              >
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  {s}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-3" />
          <span className="text-sm">Searching footage…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/10 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Results */}
      {results !== null && !loading && (
        <div className="space-y-6">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No results for "{lastQuery}"</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try different keywords, or upload and process more footage
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {results.length} result{results.length !== 1 ? "s" : ""} for "{lastQuery}"
              </p>
              {groups.map((group) => (
                <div key={group.videoId} className="space-y-2">
                  {/* Video header */}
                  <div className="flex items-center gap-2 pb-1 border-b border-border">
                    <Film className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">
                      {group.filename}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">
                      {group.items.length} hit{group.items.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Result rows */}
                  {group.items.map((result) => (
                    <Link
                      key={result.id}
                      href={`/library/${result.source_video_id}?t=${Math.floor(result.start_seconds)}`}
                      className="flex items-start gap-3 px-3 py-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors"
                    >
                      {/* Kind badge */}
                      <div
                        className={cn(
                          "mt-0.5 flex items-center justify-center w-6 h-6 rounded-md shrink-0",
                          result.kind === "label"
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-primary/15 text-primary"
                        )}
                      >
                        {result.kind === "label" ? (
                          <Tag className="w-3.5 h-3.5" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-relaxed">
                          {highlightMatch(result.text, lastQuery)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {result.start_timecode}
                          {result.kind === "label" && result.confidence != null && (
                            <span className="ml-2 text-amber-400">
                              {Math.round(result.confidence * 100)}% confidence
                            </span>
                          )}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Initial empty state — no videos processed yet */}
      {results === null && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-xl">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Film className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Search your footage</p>
          <p className="text-xs text-muted-foreground mt-1">
            Results appear here once your videos have been transcribed and processed
          </p>
        </div>
      )}
    </div>
  );
}
