-- CubbyStack Schema
-- Run this in Supabase SQL Editor on the new project

-- Extensions

create extension if not exists "vector";

-- ─────────────────────────────────────────
-- Workspaces
-- ─────────────────────────────────────────
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
alter table workspaces enable row level security;

create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
alter table workspace_members enable row level security;

-- ─────────────────────────────────────────
-- Source Videos
-- ─────────────────────────────────────────
create table source_videos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  filename text not null,
  storage_path text not null,
  duration_seconds numeric,
  fps numeric,
  file_size_bytes bigint,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table source_videos enable row level security;

-- ─────────────────────────────────────────
-- Processing Jobs
-- ─────────────────────────────────────────
create table processing_jobs (
  id uuid primary key default gen_random_uuid(),
  source_video_id uuid not null references source_videos(id) on delete cascade,
  type text not null check (type in ('transcription', 'label_generation', 'indexing', 'thumbnail_generation', 'proxy_generation')),
  status text not null default 'pending' check (status in ('pending', 'running', 'complete', 'failed')),
  attempts int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table processing_jobs enable row level security;

-- ─────────────────────────────────────────
-- Transcripts
-- ─────────────────────────────────────────
create table transcripts (
  id uuid primary key default gen_random_uuid(),
  source_video_id uuid not null unique references source_videos(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table transcripts enable row level security;

create table transcript_segments (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references transcripts(id) on delete cascade,
  source_video_id uuid not null references source_videos(id) on delete cascade,
  start_timecode text not null,
  end_timecode text not null,
  start_seconds numeric not null,
  end_seconds numeric not null,
  text text not null,
  created_at timestamptz not null default now()
);
alter table transcript_segments enable row level security;

-- ─────────────────────────────────────────
-- Labels
-- ─────────────────────────────────────────
create table labels (
  id uuid primary key default gen_random_uuid(),
  source_video_id uuid not null references source_videos(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  confidence numeric,
  start_timecode text not null,
  end_timecode text not null,
  start_seconds numeric not null,
  end_seconds numeric not null,
  created_at timestamptz not null default now()
);
alter table labels enable row level security;

-- ─────────────────────────────────────────
-- Search Index
-- ─────────────────────────────────────────
create table search_index_entries (
  id uuid primary key default gen_random_uuid(),
  source_video_id uuid not null references source_videos(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content text not null,
  search_vector tsvector generated always as (to_tsvector('english', content)) stored,
  embedding vector(1536),
  start_seconds numeric,
  end_seconds numeric,
  created_at timestamptz not null default now()
);
alter table search_index_entries enable row level security;
create index search_index_fts on search_index_entries using gin(search_vector);

-- ─────────────────────────────────────────
-- Clips
-- ─────────────────────────────────────────
create table clips (
  id uuid primary key default gen_random_uuid(),
  source_video_id uuid not null references source_videos(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  title text not null,
  notes text,
  start_timecode text not null,
  end_timecode text not null,
  start_seconds numeric not null,
  end_seconds numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table clips enable row level security;

-- ─────────────────────────────────────────
-- Timelines
-- ─────────────────────────────────────────
create table timelines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table timelines enable row level security;

create table timeline_events (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid not null references timelines(id) on delete cascade,
  clip_id uuid not null references clips(id) on delete cascade,
  position int not null,
  record_start_timecode text not null,
  record_end_timecode text not null,
  record_start_seconds numeric not null,
  record_end_seconds numeric not null,
  created_at timestamptz not null default now()
);
alter table timeline_events enable row level security;

-- ─────────────────────────────────────────
-- Exports
-- ─────────────────────────────────────────
create table exports (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid not null references timelines(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  type text not null default 'edl' check (type in ('edl')),
  storage_path text,
  status text not null default 'pending' check (status in ('pending', 'complete', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table exports enable row level security;

-- ─────────────────────────────────────────
-- Comments
-- ─────────────────────────────────────────
create table comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  asset_type text not null check (asset_type in ('source_video', 'timeline', 'export')),
  asset_id uuid not null,
  timestamp_seconds numeric,
  text text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table comments enable row level security;

-- ─────────────────────────────────────────
-- Usage Events
-- ─────────────────────────────────────────
create table usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  type text not null check (type in ('transcription_tokens', 'label_generation_tokens', 'storage_gb', 'processing_minutes')),
  units numeric not null,
  cost numeric not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);
alter table usage_events enable row level security;

-- ─────────────────────────────────────────
-- Updated_at trigger (reusable)
-- ─────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger source_videos_updated_at before update on source_videos for each row execute function update_updated_at();
create trigger processing_jobs_updated_at before update on processing_jobs for each row execute function update_updated_at();
create trigger clips_updated_at before update on clips for each row execute function update_updated_at();
create trigger timelines_updated_at before update on timelines for each row execute function update_updated_at();
create trigger timeline_events_updated_at before update on timeline_events for each row execute function update_updated_at();
create trigger exports_updated_at before update on exports for each row execute function update_updated_at();
create trigger comments_updated_at before update on comments for each row execute function update_updated_at();

-- ─────────────────────────────────────────
-- RLS Policies
-- ─────────────────────────────────────────

-- Workspace members can see their own workspaces
create policy "workspace members can view workspace"
  on workspaces for select
  using (
    id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "workspace members can view membership"
  on workspace_members for select
  using (user_id = auth.uid());

-- Source videos: workspace members only
create policy "workspace members can view source videos"
  on source_videos for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "workspace members can insert source videos"
  on source_videos for insert
  with check (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- Clips: workspace members only
create policy "workspace members can view clips"
  on clips for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "workspace members can insert clips"
  on clips for insert
  with check (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "clip owner can update"
  on clips for update
  using (user_id = auth.uid());

-- Timelines: workspace members only
create policy "workspace members can view timelines"
  on timelines for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "workspace members can insert timelines"
  on timelines for insert
  with check (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- Comments: workspace members only
create policy "workspace members can view comments"
  on comments for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "workspace members can insert comments"
  on comments for insert
  with check (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "comment owner can update"
  on comments for update
  using (user_id = auth.uid());
