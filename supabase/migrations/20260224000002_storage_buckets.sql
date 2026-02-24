-- Create the source-videos storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'source-videos',
  'source-videos',
  false,
  10737418240, -- 10 GB
  ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm', 'video/mpeg', 'video/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- Allow workspace members to upload videos
-- Path format: {workspace_id}/{video_id}/{filename}
CREATE POLICY "workspace_members_can_upload_videos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'source-videos'
    AND (storage.foldername(name))[1] IN (
      SELECT workspace_id::text
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Allow workspace members to read videos they have access to
CREATE POLICY "workspace_members_can_read_videos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'source-videos'
    AND (storage.foldername(name))[1] IN (
      SELECT workspace_id::text
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Allow workspace members to delete their workspace's videos
CREATE POLICY "workspace_members_can_delete_videos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'source-videos'
    AND (storage.foldername(name))[1] IN (
      SELECT workspace_id::text
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );
