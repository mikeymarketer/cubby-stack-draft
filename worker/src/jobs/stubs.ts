/**
 * Thumbnail generation — placeholder.
 * TODO: extract a frame at 10% into the video using FFmpeg,
 * upload to storage/thumbnails/{workspaceId}/{videoId}.jpg,
 * store path in source_videos.thumbnail_path (requires schema migration).
 */
export async function runThumbnailGeneration(_sourceVideoId: string): Promise<void> {
  console.log("[thumbnail] Skipping — not yet implemented");
}

/**
 * Indexing — placeholder.
 * Transcript segments are already queryable via full-text search on transcript_segments.text.
 * TODO: generate vector embeddings (pgvector) for semantic search.
 */
export async function runIndexing(_sourceVideoId: string): Promise<void> {
  console.log("[indexing] Marking complete — segments searchable via full-text");
}
