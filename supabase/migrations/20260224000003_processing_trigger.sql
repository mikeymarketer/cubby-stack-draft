-- Function: fires when a source_video is inserted
-- Creates the processing job queue entries and flips status to 'processing'
CREATE OR REPLACE FUNCTION handle_video_uploaded()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act on fresh inserts with status 'uploaded'
  IF NEW.status <> 'uploaded' THEN
    RETURN NEW;
  END IF;

  -- Queue: transcription first (other jobs depend on it)
  INSERT INTO processing_jobs (source_video_id, type, status)
  VALUES
    (NEW.id, 'transcription',        'pending'),
    (NEW.id, 'label_generation',     'pending'),
    (NEW.id, 'thumbnail_generation', 'pending'),
    (NEW.id, 'indexing',             'pending');

  -- Immediately mark the video as processing so the UI reflects activity
  UPDATE source_videos
  SET status = 'processing', updated_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: runs after each insert on source_videos
DROP TRIGGER IF EXISTS on_video_uploaded ON source_videos;
CREATE TRIGGER on_video_uploaded
  AFTER INSERT ON source_videos
  FOR EACH ROW
  EXECUTE FUNCTION handle_video_uploaded();

-- Enable Realtime for source_videos so the UI can subscribe to changes
ALTER PUBLICATION supabase_realtime ADD TABLE source_videos;
