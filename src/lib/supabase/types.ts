// Auto-maintained type file — update when schema changes

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SourceVideoStatus = "uploaded" | "processing" | "ready" | "failed";
export type ProcessingJobType =
  | "transcription"
  | "label_generation"
  | "indexing"
  | "thumbnail_generation"
  | "proxy_generation";
export type ProcessingJobStatus = "pending" | "running" | "complete" | "failed";
export type ExportType = "edl";
export type CommentStatus = "open" | "resolved";
export type CommentAssetType = "source_video" | "timeline" | "export";
export type UsageEventType =
  | "transcription_tokens"
  | "label_generation_tokens"
  | "storage_gb"
  | "processing_minutes";
export type WorkspaceRole = "owner" | "admin" | "member";

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: WorkspaceRole;
          created_at?: string;
        };
        Update: {
          role?: WorkspaceRole;
        };
        Relationships: [];
      };
      source_videos: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          filename: string;
          storage_path: string;
          duration_seconds: number | null;
          fps: number | null;
          file_size_bytes: number | null;
          status: SourceVideoStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          filename: string;
          storage_path: string;
          duration_seconds?: number | null;
          fps?: number | null;
          file_size_bytes?: number | null;
          status?: SourceVideoStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          duration_seconds?: number | null;
          fps?: number | null;
          file_size_bytes?: number | null;
          status?: SourceVideoStatus;
          updated_at?: string;
        };
        Relationships: [];
      };
      processing_jobs: {
        Row: {
          id: string;
          source_video_id: string;
          type: ProcessingJobType;
          status: ProcessingJobStatus;
          attempts: number;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_video_id: string;
          type: ProcessingJobType;
          status?: ProcessingJobStatus;
          attempts?: number;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: ProcessingJobStatus;
          attempts?: number;
          error?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      transcripts: {
        Row: {
          id: string;
          source_video_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_video_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      transcript_segments: {
        Row: {
          id: string;
          transcript_id: string;
          source_video_id: string;
          start_timecode: string;
          end_timecode: string;
          start_seconds: number;
          end_seconds: number;
          text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          transcript_id: string;
          source_video_id: string;
          start_timecode: string;
          end_timecode: string;
          start_seconds: number;
          end_seconds: number;
          text: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      labels: {
        Row: {
          id: string;
          source_video_id: string;
          workspace_id: string;
          name: string;
          confidence: number | null;
          start_timecode: string;
          end_timecode: string;
          start_seconds: number;
          end_seconds: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_video_id: string;
          workspace_id: string;
          name: string;
          confidence?: number | null;
          start_timecode: string;
          end_timecode: string;
          start_seconds: number;
          end_seconds: number;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      clips: {
        Row: {
          id: string;
          source_video_id: string;
          workspace_id: string;
          user_id: string;
          title: string;
          notes: string | null;
          start_timecode: string;
          end_timecode: string;
          start_seconds: number;
          end_seconds: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_video_id: string;
          workspace_id: string;
          user_id: string;
          title: string;
          notes?: string | null;
          start_timecode: string;
          end_timecode: string;
          start_seconds: number;
          end_seconds: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          notes?: string | null;
          start_timecode?: string;
          end_timecode?: string;
          start_seconds?: number;
          end_seconds?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      timelines: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      timeline_events: {
        Row: {
          id: string;
          timeline_id: string;
          clip_id: string;
          position: number;
          record_start_timecode: string;
          record_end_timecode: string;
          record_start_seconds: number;
          record_end_seconds: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          timeline_id: string;
          clip_id: string;
          position: number;
          record_start_timecode: string;
          record_end_timecode: string;
          record_start_seconds: number;
          record_end_seconds: number;
          created_at?: string;
        };
        Update: {
          position?: number;
          record_start_timecode?: string;
          record_end_timecode?: string;
          record_start_seconds?: number;
          record_end_seconds?: number;
        };
        Relationships: [];
      };
      exports: {
        Row: {
          id: string;
          timeline_id: string;
          workspace_id: string;
          user_id: string;
          type: ExportType;
          storage_path: string | null;
          status: "pending" | "complete" | "failed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          timeline_id: string;
          workspace_id: string;
          user_id: string;
          type?: ExportType;
          storage_path?: string | null;
          status?: "pending" | "complete" | "failed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          storage_path?: string | null;
          status?: "pending" | "complete" | "failed";
          updated_at?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          asset_type: CommentAssetType;
          asset_id: string;
          timestamp_seconds: number | null;
          text: string;
          status: CommentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          asset_type: CommentAssetType;
          asset_id: string;
          timestamp_seconds?: number | null;
          text: string;
          status?: CommentStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          text?: string;
          status?: CommentStatus;
          updated_at?: string;
        };
        Relationships: [];
      };
      usage_events: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          type: UsageEventType;
          units: number;
          cost: number;
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          type: UsageEventType;
          units: number;
          cost: number;
          reference_id?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
