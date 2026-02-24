import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  // Verify authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request
  let body: { filename: string; contentType: string; fileSizeBytes: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { filename, contentType, fileSizeBytes } = body;
  if (!filename || !contentType || !fileSizeBytes) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Get user's workspace
  const { data: membershipData } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const membership = membershipData as { workspace_id: string } | null;
  if (!membership) {
    return NextResponse.json({ error: "No workspace found" }, { status: 403 });
  }

  const { workspace_id } = membership;

  // Generate a unique video ID and storage path
  const videoId = crypto.randomUUID();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${workspace_id}/${videoId}/${sanitizedFilename}`;

  // Create the source_videos record (status: uploaded)
  const { error: insertError } = await supabase
    .from("source_videos")
    .insert({
      id: videoId,
      workspace_id,
      user_id: user.id,
      filename,
      storage_path: storagePath,
      file_size_bytes: fileSizeBytes,
      status: "uploaded",
    });

  if (insertError) {
    console.error("[presign] DB insert error:", insertError);
    return NextResponse.json({ error: "Failed to create video record" }, { status: 500 });
  }

  return NextResponse.json({ videoId, storagePath });
}
