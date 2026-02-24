import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { supabase } from "./supabase";

/**
 * Download a file from Supabase Storage to a temp path.
 * Returns the local file path. Caller is responsible for cleanup.
 */
export async function downloadToTemp(
  bucket: string,
  storagePath: string,
  ext?: string
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);

  if (error || !data) {
    throw new Error(`Storage download failed for ${storagePath}: ${error?.message}`);
  }

  const suffix = ext ?? path.extname(storagePath) ?? ".bin";
  const tempPath = path.join(os.tmpdir(), `cubby-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  fs.writeFileSync(tempPath, buffer);

  return tempPath;
}

/**
 * Upload a local file to Supabase Storage.
 */
export async function uploadFromFile(
  bucket: string,
  storagePath: string,
  localPath: string,
  contentType: string
): Promise<void> {
  const buffer = fs.readFileSync(localPath);
  const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Storage upload failed for ${storagePath}: ${error.message}`);
  }
}

/** Delete a local temp file, ignoring errors. */
export function cleanupTemp(...paths: string[]): void {
  for (const p of paths) {
    try { fs.unlinkSync(p); } catch { /* ignore */ }
  }
}
