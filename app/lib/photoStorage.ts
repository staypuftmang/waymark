import type { SupabaseClient } from "@supabase/supabase-js";

export const PHOTOS_BUCKET = "journal-photos";

export const SIGNED_URL_TTL_SECONDS = 60 * 60;

// A storage path looks like `<userUUID>/<journalUUID>/<photoId>.jpg`.
// We detect it by the leading UUID + slash. Anything else (data URLs, bare
// http(s) URLs, empty strings) is treated as legacy / non-storage content.
const STORAGE_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i;

export function isStoragePath(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("data:")) return false;
  if (src.startsWith("http://") || src.startsWith("https://")) return false;
  return STORAGE_PATH_RE.test(src);
}

interface DecodedDataUrl {
  bytes: Uint8Array;
  contentType: string;
}

function decodeDataUrl(dataUrl: string): DecodedDataUrl {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) throw new Error("Invalid data URL");
  const header = dataUrl.slice(0, commaIdx);
  const data = dataUrl.slice(commaIdx + 1);
  const m = header.match(/data:([^;]+)/);
  const contentType = m ? m[1] : "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType };
}

/**
 * Upload a base64 data-URL photo to the journal-photos bucket. Returns
 * the storage path (e.g. `<userId>/<journalId>/<photoId>.jpg`) which the
 * caller is expected to persist in journal_photos.src.
 *
 * Uses the caller's authenticated supabase client so RLS (auth.uid must
 * match the leading folder) is enforced.
 */
export async function uploadPhoto(
  client: SupabaseClient,
  userId: string,
  journalId: string,
  photoId: number | string,
  base64DataUrl: string,
): Promise<string> {
  const { bytes, contentType } = decodeDataUrl(base64DataUrl);
  const path = `${userId}/${journalId}/${photoId}.jpg`;
  const { error } = await client.storage
    .from(PHOTOS_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

/**
 * Generate a signed URL for the calling user's own photo. Used in the
 * authenticated flows (loadJournal, listJournals) where the user's
 * supabase client provides RLS-gated access.
 */
export async function getPhotoUrl(
  client: SupabaseClient,
  storagePath: string,
): Promise<string> {
  const { data, error } = await client.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Delete every photo in a journal's storage folder. Called when the user
 * deletes a journal so storage doesn't accumulate orphaned objects.
 */
export async function deleteJournalPhotos(
  client: SupabaseClient,
  userId: string,
  journalId: string,
): Promise<void> {
  const folder = `${userId}/${journalId}`;
  const { data: list, error: listErr } = await client.storage
    .from(PHOTOS_BUCKET)
    .list(folder);
  if (listErr) throw listErr;
  const paths = (list ?? []).map((f) => `${folder}/${f.name}`);
  if (paths.length === 0) return;
  const { error: delErr } = await client.storage
    .from(PHOTOS_BUCKET)
    .remove(paths);
  if (delErr) throw delErr;
}
