ALTER TABLE timelines ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ideation';
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS must_use boolean NOT NULL DEFAULT false;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS notes text;
