export type ProcessingJobType =
  | "transcription"
  | "label_generation"
  | "indexing"
  | "thumbnail_generation"
  | "proxy_generation";

export type ProcessingJobStatus = "pending" | "running" | "complete" | "failed";

export interface ProcessingJob {
  id: string;
  source_video_id: string;
  type: ProcessingJobType;
  status: ProcessingJobStatus;
  attempts: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}
