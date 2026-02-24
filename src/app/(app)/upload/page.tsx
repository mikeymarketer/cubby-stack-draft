"use client";

import { useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  Upload,
  CloudUpload,
  Film,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QueueItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  errorMessage?: string;
}

const ACCEPTED_TYPES = [
  "video/mp4", "video/quicktime", "video/x-msvideo",
  "video/x-matroska", "video/webm", "video/mpeg",
];
const ACCEPTED_EXTS = ["MP4", "MOV", "AVI", "MKV", "WEBM", "MPG"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const valid = Array.from(files).filter((f) => {
      if (
        !ACCEPTED_TYPES.includes(f.type) &&
        !f.name.match(/\.(mp4|mov|avi|mkv|webm|mpg|mpeg)$/i)
      ) return false;
      if (f.size > MAX_SIZE_BYTES) return false;
      return true;
    });
    if (valid.length === 0) return;

    setQueue((prev) => [
      ...prev,
      ...valid.map((file) => ({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: "pending" as const,
      })),
    ]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFiles(e.target.files);
      e.target.value = "";
    },
    [addFiles]
  );

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const startUploads = useCallback(async () => {
    if (uploadingRef.current) return;
    const pending = queue.filter((item) => item.status === "pending");
    if (pending.length === 0) return;

    uploadingRef.current = true;
    const supabase = createClient();

    for (const item of pending) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id ? { ...q, status: "uploading", progress: 0 } : q
        )
      );

      try {
        // Step 1: Register the video in the DB and get a storage path
        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: item.file.name,
            contentType: item.file.type || "video/mp4",
            fileSizeBytes: item.file.size,
          }),
        });

        if (!presignRes.ok) {
          const err = await presignRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? "Failed to initialize upload");
        }

        const { storagePath } = await presignRes.json() as { storagePath: string };

        // Step 2: Upload directly to Supabase Storage with progress
        const uploadOptions = {
          contentType: item.file.type || "video/mp4",
          upsert: false,
          onUploadProgress: (p: { loaded: number; total: number }) => {
            const pct = Math.round((p.loaded / p.total) * 100);
            setQueue((prev) =>
              prev.map((q) => q.id === item.id ? { ...q, progress: pct } : q)
            );
          },
        };
        const { error: uploadError } = await (supabase.storage
          .from("source-videos")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .upload as any)(storagePath, item.file, uploadOptions);

        if (uploadError) throw new Error(uploadError.message);

        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: "complete", progress: 100 } : q
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: "error", errorMessage: message } : q
          )
        );
      }
    }

    uploadingRef.current = false;
  }, [queue]);

  const pendingCount = queue.filter((q) => q.status === "pending").length;
  const uploadingCount = queue.filter((q) => q.status === "uploading").length;
  const completeCount = queue.filter((q) => q.status === "complete").length;

  return (
    <>
      <PageHeader
        title="Upload Videos"
        description="Add videos to your library for AI-powered search and indexing"
      />

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: Drop zone + queue */}
        <div className="lg:col-span-3 space-y-6">
          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed",
              "p-16 text-center transition-all cursor-pointer select-none",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-accent/20"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mp4,.mov,.avi,.mkv,.webm"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
            <div className={cn("p-4 rounded-full", isDragging ? "bg-primary/15" : "bg-accent")}>
              <CloudUpload
                className={cn("w-8 h-8", isDragging ? "text-primary" : "text-muted-foreground")}
              />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">Drop video files here</p>
              <p className="text-sm text-muted-foreground mt-1">
                or <span className="text-primary hover:underline">browse to upload</span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {ACCEPTED_EXTS.map((fmt) => (
                <Badge key={fmt} variant="outline" className="text-xs font-mono">
                  {fmt}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Max 10 GB per file</p>
          </div>

          {/* Upload queue */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Upload Queue</CardTitle>
                <div className="flex items-center gap-2">
                  {completeCount > 0 && (
                    <span className="text-xs text-emerald-400">{completeCount} done</span>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {queue.length} {queue.length === 1 ? "file" : "files"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {queue.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-xs text-muted-foreground">
                      Drop files above to add them to the queue
                    </p>
                  </div>
                ) : (
                  queue.map((item) => (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-accent shrink-0">
                          {item.status === "complete" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : item.status === "error" ? (
                            <XCircle className="w-4 h-4 text-red-400" />
                          ) : item.status === "uploading" ? (
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                          ) : (
                            <Film className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <p className="text-sm font-medium truncate">{item.file.name}</p>
                            <button
                              onClick={() => removeItem(item.id)}
                              disabled={item.status === "uploading"}
                              className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(item.file.size)}
                            {item.status === "error" && item.errorMessage && (
                              <span className="text-red-400 ml-2">— {item.errorMessage}</span>
                            )}
                          </p>
                          {item.status === "uploading" && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <Progress value={item.progress} className="h-1.5 flex-1" />
                              <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
                                {item.progress}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Action panel */}
        <div className="lg:col-span-2">
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Ready to Upload</CardTitle>
              <p className="text-xs text-muted-foreground">
                {uploadingCount > 0
                  ? `Uploading ${uploadingCount} file${uploadingCount > 1 ? "s" : ""}…`
                  : pendingCount > 0
                  ? `${pendingCount} file${pendingCount > 1 ? "s" : ""} queued`
                  : completeCount > 0
                  ? `${completeCount} file${completeCount > 1 ? "s" : ""} uploaded`
                  : "Add files from the drop zone"}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground text-xs">What happens after upload:</p>
                <p>1. Video is stored securely in your workspace</p>
                <p>2. Audio is transcribed automatically</p>
                <p>3. AI labels detect scenes, objects, and text</p>
                <p>4. Video becomes searchable in seconds</p>
              </div>

              <Button
                className="w-full"
                disabled={pendingCount === 0 || uploadingCount > 0}
                onClick={startUploads}
              >
                {uploadingCount > 0 ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {pendingCount > 0
                      ? `Upload ${pendingCount} File${pendingCount > 1 ? "s" : ""}`
                      : "Upload"}
                  </>
                )}
              </Button>

              {completeCount > 0 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => (window.location.href = "/library")}
                >
                  View in Library
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
