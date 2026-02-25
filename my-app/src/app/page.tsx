import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Film,
  HardDrive,
  CheckCircle2,
  SearchIcon,
  Clock,
} from "lucide-react";
import { mockVideos, mockRecentSearches, mockStats } from "@/lib/mock-data";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  processed: "default",
  processing: "secondary",
  queued: "outline",
};

const statusColor: Record<string, string> = {
  processed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  processing: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  queued: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

export default function DashboardPage() {
  const recentUploads = mockVideos.slice(0, 5);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your video library and activity
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Total Videos
              </p>
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <Film className="w-4 h-4 text-indigo-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground">
              {mockStats.totalVideos}
            </p>
            <p className="text-xs text-muted-foreground mt-1">+12 this week</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Storage Used
              </p>
              <div className="p-2 rounded-lg bg-sky-500/10">
                <HardDrive className="w-4 h-4 text-sky-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground">
              {mockStats.storageUsed}
            </p>
            <p className="text-xs text-muted-foreground mt-1">of 500 GB plan</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Processed
              </p>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground">
              {mockStats.videosProcessed}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {mockStats.totalVideos - mockStats.videosProcessed} pending
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Searches Today
              </p>
              <div className="p-2 rounded-lg bg-violet-500/10">
                <SearchIcon className="w-4 h-4 text-violet-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground">
              {mockStats.searchesToday}
            </p>
            <p className="text-xs text-muted-foreground mt-1">+8 from yesterday</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Uploads */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">
              Recent Uploads
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {recentUploads.map((video) => (
                <div
                  key={video.id}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-accent/30 transition-colors"
                >
                  {/* Thumbnail placeholder */}
                  <div
                    className="w-14 h-9 rounded-md shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: video.color + "33" }}
                  >
                    <Film className="w-4 h-4" style={{ color: video.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {video.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {video.duration} · {video.uploadDate}
                    </p>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-xs shrink-0 ${statusColor[video.status]}`}
                  >
                    {video.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Searches */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">
              Recent Searches
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {mockRecentSearches.map((search) => (
                <div
                  key={search.id}
                  className="flex items-center gap-3 px-6 py-3.5 hover:bg-accent/30 transition-colors cursor-pointer"
                >
                  <div className="p-1.5 rounded-md bg-violet-500/10 shrink-0">
                    <SearchIcon className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      &ldquo;{search.query}&rdquo;
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {search.resultsCount} result{search.resultsCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="w-3 h-3" />
                    {search.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
