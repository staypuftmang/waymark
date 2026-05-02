import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { PHOTOS_BUCKET, SIGNED_URL_TTL_SECONDS } from "./photoStorage";

/**
 * Server-side signed URL for public journal rendering. The journal-photos
 * bucket is private, so /j/[slug] (rendered with the service-role client)
 * signs each photo URL before handing it to the browser. The TTL matches
 * the page's `revalidate = 3600`, so cached HTML never points at a URL
 * that has already expired.
 */
export async function getPublicPhotoUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}
