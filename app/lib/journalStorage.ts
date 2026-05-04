import { supabase } from "./supabase";
import type { Photo, VisualStyleKey, WordStyleKey, LayoutKey, LengthKey, Colophon } from "./types";
import { DEFAULT_COLOPHON } from "./types";
import {
  PHOTOS_BUCKET,
  deleteJournalPhotos as deleteJournalPhotoStorage,
  getPhotoUrl,
  isStoragePath,
  uploadPhoto,
} from "./photoStorage";

export type JournalMode = "quick" | "full";

export interface JournalData {
  id: string | null;
  mode: JournalMode;
  tripTitle: string;
  tripBrief: string;
  startDate: string | null; // ISO yyyy-mm-dd
  endDate: string | null;
  visualStyle: VisualStyleKey;
  wordStyle: WordStyleKey;
  length: LengthKey;
  /** ws/len in effect the last time the AI generated or rewrote content
   * for this journal. Compared against current ws/len on Update Journal
   * to decide whether to prompt the user to regenerate. */
  generationWordStyle: WordStyleKey | null;
  generationLength: LengthKey | null;
  layout: LayoutKey;
  coverPhotoId: number | string | null;
  coverTitle: string;
  coverSubtitle: string;
  coverTitleEdited: boolean;
  photos: Photo[];
  /** Trip-details closing section. Null on freshly-created journals (no
   * colophon yet); populated by the post-narrative AI generation step. */
  colophon: Colophon | null;
}

export interface LoadedJournal {
  data: JournalData;
  photoRemoteIds: Record<number, string>;
  /** clientId → storage path. Populated for photos whose DB src column
   * is a storage path. The display src on the photo itself is a signed
   * URL (resolveStoragePaths !== false) or the raw path; this map lets
   * the save layer remember the underlying path so it can re-persist it
   * without re-uploading. */
  photoStoragePaths: Record<number, string>;
}

export interface JournalSummary {
  id: string;
  title: string;
  mode: JournalMode;
  visualStyle: string;
  layout: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  coverPhotoSrc: string | null;
  /** Focal point of the cover photo, if customised. NULL → render with
   * default center. Lets the dashboard JournalCard apply object-position
   * without re-fetching the photo row. */
  coverFocalPoint: { x: number; y: number } | null;
  isPublic: boolean;
  shareSlug: string | null;
}

export type PhotoTextFields = Partial<{
  caption: string;
  notes: string;
  paragraph: string;
  ai_caption: string;
  ai_notes: string;
  ai_paragraph: string;
  is_cover: boolean;
  focal_x: number | null;
  focal_y: number | null;
}>;

interface JournalRow {
  id: string;
  title: string | null;
  mode: string | null;
  trip_brief: string | null;
  start_date: string | null;
  end_date: string | null;
  visual_style: string;
  word_style: string;
  length: string;
  generation_word_style: string | null;
  generation_length: string | null;
  layout: string;
  cover_photo_id: string | null;
  cover_title: string | null;
  cover_subtitle: string | null;
  cover_title_edited: boolean;
  colophon: Colophon | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface JournalPhotoRow {
  id: string;
  src: string;
  caption: string | null;
  notes: string | null;
  paragraph: string | null;
  ai_caption: string | null;
  ai_notes: string | null;
  ai_paragraph: string | null;
  is_cover: boolean;
  photo_order: number;
  focal_x: number | null;
  focal_y: number | null;
}

export function journalToFields(d: JournalData) {
  return {
    title: d.tripTitle,
    mode: d.mode,
    trip_brief: d.tripBrief,
    start_date: d.startDate,
    end_date: d.endDate,
    visual_style: d.visualStyle,
    word_style: d.wordStyle,
    length: d.length,
    generation_word_style: d.generationWordStyle,
    generation_length: d.generationLength,
    layout: d.layout,
    // cover_photo_id is a UUID column, but client-side photo ids are numeric.
    // is_cover on each journal_photos row is the source of truth instead.
    cover_photo_id: null,
    cover_title: d.coverTitle,
    cover_subtitle: d.coverSubtitle,
    cover_title_edited: d.coverTitleEdited,
    colophon: d.colophon,
  };
}

function photoInsertRow(journalId: string, photo: Photo, order: number, coverPhotoId: number | string | null) {
  return {
    journal_id: journalId,
    photo_order: order,
    src: photo.src,
    caption: photo.caption || "",
    notes: photo.notes || "",
    paragraph: photo.paragraph || "",
    ai_caption: photo.aiCaption || "",
    ai_notes: photo.aiNotes || "",
    ai_paragraph: photo.aiParagraph || "",
    is_cover: coverPhotoId != null && String(photo.id) === String(coverPhotoId),
    focal_x: photo.focalPoint ? Math.round(photo.focalPoint.x) : null,
    focal_y: photo.focalPoint ? Math.round(photo.focalPoint.y) : null,
  };
}

export function isEmptyJournal(d: JournalData): boolean {
  return !d.tripTitle.trim() && !d.tripBrief.trim() && d.photos.length === 0;
}

/**
 * Save journal metadata only. Creates a new journal row if journalId is null,
 * otherwise updates the existing row. Never touches journal_photos.
 * Returns the journal id (newly created or passed in).
 */
export async function saveJournalMetadata(
  userId: string,
  journalId: string | null,
  data: JournalData,
): Promise<string> {
  const fields = journalToFields(data);
  if (journalId) {
    const { error } = await supabase
      .from("journals")
      .update(fields)
      .eq("id", journalId)
      .eq("user_id", userId);
    if (error) throw error;
    return journalId;
  }
  const { data: row, error } = await supabase
    .from("journals")
    .insert({ user_id: userId, ...fields })
    .select("id")
    .single();
  if (error) throw error;
  return row.id as string;
}

export interface SyncJournalPhotosResult {
  /** clientId → DB row UUID. Used by the caller to target individual
   * rows for later text updates. */
  remoteIdMap: Record<number, string>;
  /** clientId → storage path. Reflects the post-sync state. Includes
   * pre-existing paths and any new paths from fresh uploads. The caller
   * keeps this map so the next sync knows which photos already live in
   * Storage and shouldn't be re-uploaded. */
  storagePaths: Record<number, string>;
}

/**
 * Wholesale delete + reinsert of every journal_photos row for a journal.
 * Use only when photos are added, removed, reordered, or the cover
 * assignment changes.
 *
 * Lazy migration: any photo whose src is still a base64 data URL is
 * uploaded to the journal-photos bucket here, and the storage path is
 * what gets persisted in journal_photos.src. Photos already known to
 * have storage paths (via knownStoragePaths) reuse those paths; raw
 * storage-path strings in src (e.g. duplicateJournal's freshly-copied
 * photos) pass through; legacy unknown strings are persisted as-is.
 */
export async function syncJournalPhotos(
  userId: string,
  journalId: string,
  data: JournalData,
  knownStoragePaths: Record<number, string> = {},
): Promise<SyncJournalPhotosResult> {
  const { error: delErr } = await supabase
    .from("journal_photos")
    .delete()
    .eq("journal_id", journalId);
  if (delErr) throw delErr;

  if (data.photos.length === 0) {
    return { remoteIdMap: {}, storagePaths: {} };
  }

  const storagePaths: Record<number, string> = {};
  const photosForInsert: Photo[] = await Promise.all(
    data.photos.map(async (p) => {
      // 1. Raw storage path passed in directly (e.g. from duplicateJournal).
      if (isStoragePath(p.src)) {
        storagePaths[p.id] = p.src;
        return p;
      }
      // 2. Already uploaded — display src is a signed URL, real path
      //    lives in the caller's knownStoragePaths map.
      const known = knownStoragePaths[p.id];
      if (known) {
        storagePaths[p.id] = known;
        return { ...p, src: known };
      }
      // 3. Fresh base64 — upload now and remember the path.
      if (p.src.startsWith("data:")) {
        console.log(`Migrating photo ${p.id} from base64 to Storage for journal ${journalId}`);
        const path = await uploadPhoto(supabase, userId, journalId, p.id, p.src);
        storagePaths[p.id] = path;
        return { ...p, src: path };
      }
      // 4. Legacy / unknown string — pass through to preserve back-compat.
      return p;
    }),
  );

  const rows = photosForInsert.map((p, i) =>
    photoInsertRow(journalId, p, i, data.coverPhotoId),
  );
  const { data: inserted, error: insErr } = await supabase
    .from("journal_photos")
    .insert(rows)
    .select("id, photo_order");
  if (insErr) throw insErr;

  const byOrder: Record<number, string> = {};
  (inserted ?? []).forEach((r) => { byOrder[(r as { photo_order: number }).photo_order] = (r as { id: string }).id; });
  const remoteIdMap: Record<number, string> = {};
  photosForInsert.forEach((p, i) => {
    const remoteId = byOrder[i];
    if (remoteId) remoteIdMap[p.id] = remoteId;
  });
  return { remoteIdMap, storagePaths };
}

/**
 * Targeted UPDATE for a single photo row's text/flag fields. Does NOT touch
 * the base64 src column or photo_order. Use for caption/notes/paragraph
 * edits on existing rows.
 */
export async function updatePhotoFields(
  remoteId: string,
  fields: PhotoTextFields,
): Promise<void> {
  if (Object.keys(fields).length === 0) return;
  const { error } = await supabase
    .from("journal_photos")
    .update(fields)
    .eq("id", remoteId);
  if (error) throw error;
}

export interface LoadJournalOptions {
  /** When false, photo src values are returned as raw storage paths (or
   * legacy base64) without being signed. Used by callers like
   * duplicateJournal that need the path itself, not a fetchable URL.
   * Defaults to true (Step 4 will swap in signed URLs for storage paths). */
  resolveStoragePaths?: boolean;
}

export async function loadJournal(
  journalId: string,
  opts: LoadJournalOptions = {},
): Promise<LoadedJournal> {
  const resolveStoragePaths = opts.resolveStoragePaths !== false;
  const { data: journal, error: journalError } = await supabase
    .from("journals")
    .select("*")
    .eq("id", journalId)
    .single<JournalRow>();
  if (journalError) throw journalError;

  const { data: photos, error: photosError } = await supabase
    .from("journal_photos")
    .select("*")
    .eq("journal_id", journalId)
    .order("photo_order", { ascending: true })
    .returns<JournalPhotoRow[]>();
  if (photosError) throw photosError;

  const photoRows = photos ?? [];
  const resolvedSrcs: string[] = await Promise.all(
    photoRows.map(async (p) => {
      if (resolveStoragePaths && isStoragePath(p.src)) {
        try {
          return await getPhotoUrl(supabase, p.src);
        } catch (err) {
          console.warn(`Failed to sign photo URL for ${p.src}:`, err);
          return p.src;
        }
      }
      return p.src;
    }),
  );

  const photoObjs: Photo[] = photoRows.map((p, i) => ({
    id: i + 1,
    src: resolvedSrcs[i],
    caption: p.caption ?? "",
    notes: p.notes ?? "",
    paragraph: p.paragraph ?? "",
    aiCaption: p.ai_caption ?? "",
    aiNotes: p.ai_notes ?? "",
    aiParagraph: p.ai_paragraph ?? "",
    focalPoint:
      p.focal_x != null && p.focal_y != null
        ? { x: p.focal_x, y: p.focal_y }
        : undefined,
  }));

  const coverIdx = (photos ?? []).findIndex((p) => p.is_cover);
  const coverPhotoId = coverIdx >= 0 ? photoObjs[coverIdx].id : null;

  const photoRemoteIds: Record<number, string> = {};
  const photoStoragePaths: Record<number, string> = {};
  photoRows.forEach((p, i) => {
    const clientId = photoObjs[i].id;
    photoRemoteIds[clientId] = p.id;
    if (isStoragePath(p.src)) photoStoragePaths[clientId] = p.src;
  });

  return {
    data: {
      id: journal.id,
      mode: (journal.mode === "full" ? "full" : "quick") as JournalMode,
      tripTitle: journal.title ?? "",
      tripBrief: journal.trip_brief ?? "",
      startDate: journal.start_date,
      endDate: journal.end_date,
      visualStyle: (journal.visual_style || "editorial") as VisualStyleKey,
      wordStyle: (journal.word_style || "poetic") as WordStyleKey,
      length: (journal.length || "standard") as LengthKey,
      generationWordStyle: (journal.generation_word_style as WordStyleKey | null) ?? null,
      generationLength: (journal.generation_length as LengthKey | null) ?? null,
      layout: (journal.layout || "classic") as LayoutKey,
      coverPhotoId,
      coverTitle: journal.cover_title ?? "",
      coverSubtitle: journal.cover_subtitle ?? "",
      coverTitleEdited: !!journal.cover_title_edited,
      photos: photoObjs,
      colophon: journal.colophon ?? null,
    },
    photoRemoteIds,
    photoStoragePaths,
  };
}

export async function listJournals(userId: string): Promise<JournalSummary[]> {
  // Two-step fetch so the dashboard never downloads the full src column
  // for every photo in every journal — pre-migration that was megabytes
  // of base64 per journal. We pull metadata first, then only candidate
  // cover-thumb rows (is_cover OR photo_order = 0).
  const { data: journalRows, error } = await supabase
    .from("journals")
    .select(
      "id, title, mode, visual_style, layout, status, share_slug, is_public, created_at, updated_at"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const journals = (journalRows ?? []) as Array<{
    id: string;
    title: string | null;
    mode: string | null;
    visual_style: string;
    layout: string;
    status: string;
    share_slug: string | null;
    is_public: boolean | null;
    created_at: string;
    updated_at: string;
  }>;

  if (journals.length === 0) return [];

  const journalIds = journals.map((j) => j.id);
  const { data: photoRows, error: photoErr } = await supabase
    .from("journal_photos")
    .select("journal_id, src, is_cover, photo_order, focal_x, focal_y")
    .in("journal_id", journalIds)
    .or("is_cover.eq.true,photo_order.eq.0")
    .returns<{
      journal_id: string;
      src: string;
      is_cover: boolean;
      photo_order: number;
      focal_x: number | null;
      focal_y: number | null;
    }[]>();
  if (photoErr) throw photoErr;

  type CoverCandidate = {
    src: string;
    is_cover: boolean;
    photo_order: number;
    focal_x: number | null;
    focal_y: number | null;
  };
  const candidates = new Map<string, CoverCandidate[]>();
  for (const p of photoRows ?? []) {
    const arr = candidates.get(p.journal_id) ?? [];
    arr.push({
      src: p.src,
      is_cover: p.is_cover,
      photo_order: p.photo_order,
      focal_x: p.focal_x,
      focal_y: p.focal_y,
    });
    candidates.set(p.journal_id, arr);
  }

  const summaries = await Promise.all(journals.map(async (row) => {
    const list = candidates.get(row.id) ?? [];
    const cover = list.find((p) => p.is_cover);
    const firstByOrder = [...list].sort((a, b) => a.photo_order - b.photo_order)[0];
    const chosen = cover ?? firstByOrder;
    const rawSrc = chosen?.src ?? null;
    let coverPhotoSrc: string | null = rawSrc;
    if (rawSrc && isStoragePath(rawSrc)) {
      try {
        coverPhotoSrc = await getPhotoUrl(supabase, rawSrc);
      } catch (err) {
        console.warn(`Failed to sign cover URL for journal ${row.id}:`, err);
        coverPhotoSrc = null;
      }
    }
    const coverFocalPoint =
      chosen && chosen.focal_x != null && chosen.focal_y != null
        ? { x: chosen.focal_x, y: chosen.focal_y }
        : null;
    return {
      id: row.id,
      title: row.title ?? "",
      mode: (row.mode === "full" ? "full" : "quick") as JournalMode,
      visualStyle: row.visual_style,
      layout: row.layout,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      coverPhotoSrc,
      coverFocalPoint,
      isPublic: !!row.is_public,
      shareSlug: row.share_slug,
    } as JournalSummary;
  }));

  return summaries;
}

// ── Public-journal view analytics ──────────────────────────────────────────

export interface JournalViewStats {
  total: number;
  lastWeek: number;
  topReferrers: Array<{ host: string; count: number }>;
  topCountries: Array<{ country: string; count: number }>;
}

/**
 * Total view count per public journal owned by the calling user.
 * Backed by the get_my_journal_view_counts() RPC, which is SECURITY
 * DEFINER and gates on auth.uid() so the dashboard never pulls raw view
 * rows for a journal it doesn't own.
 */
export async function getJournalViewCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("get_my_journal_view_counts");
  if (error) {
    console.warn("Failed to fetch journal view counts:", error);
    return {};
  }
  const map: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ journal_id: string; view_count: number | string }>) {
    map[row.journal_id] = Number(row.view_count) || 0;
  }
  return map;
}

function extractHost(referrer: string | null): string {
  if (!referrer) return "direct";
  try {
    const u = new URL(referrer);
    return u.hostname || "direct";
  } catch {
    return "direct";
  }
}

const STATS_FETCH_LIMIT = 5000;

/**
 * Aggregated stats for a single journal: total views, views in the last
 * 7 days, top 5 referrer hosts, top 5 countries. RLS gates the read on
 * the owner; passing a journalId not owned by the caller returns zeros.
 *
 * For volumes above STATS_FETCH_LIMIT this only summarises the most
 * recent rows — fine for the personal-dashboard scale this app targets.
 */
export async function getJournalStats(journalId: string): Promise<JournalViewStats> {
  const empty: JournalViewStats = { total: 0, lastWeek: 0, topReferrers: [], topCountries: [] };
  const { data, error } = await supabase
    .from("journal_views")
    .select("viewed_at, referrer, country")
    .eq("journal_id", journalId)
    .order("viewed_at", { ascending: false })
    .limit(STATS_FETCH_LIMIT)
    .returns<Array<{ viewed_at: string; referrer: string | null; country: string | null }>>();
  if (error) {
    console.warn("Failed to fetch journal stats:", error);
    return empty;
  }
  const rows = data ?? [];
  if (rows.length === 0) return empty;

  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const referrerCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  let lastWeek = 0;
  for (const r of rows) {
    if (new Date(r.viewed_at).getTime() >= weekAgo) lastWeek++;
    const host = extractHost(r.referrer);
    referrerCounts.set(host, (referrerCounts.get(host) ?? 0) + 1);
    const c = r.country?.trim() || "Unknown";
    countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  return {
    total: rows.length,
    lastWeek,
    topReferrers: top(referrerCounts).map(([host, count]) => ({ host, count })),
    topCountries: top(countryCounts).map(([country, count]) => ({ country, count })),
  };
}

export async function deleteJournal(userId: string, journalId: string): Promise<void> {
  const { error } = await supabase
    .from("journals")
    .delete()
    .eq("id", journalId)
    .eq("user_id", userId);
  if (error) throw error;
  // Best-effort storage cleanup. Any failure is swallowed: the DB row is
  // already gone so the user-facing operation has succeeded — orphaned
  // storage objects are a minor cost compared to a confusing error.
  try {
    await deleteJournalPhotoStorage(supabase, userId, journalId);
  } catch (err) {
    console.warn("Failed to delete journal photo storage:", err);
  }
}

export async function renameJournal(userId: string, journalId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from("journals")
    .update({ title })
    .eq("id", journalId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function duplicateJournal(userId: string, journalId: string): Promise<string> {
  // resolveStoragePaths: false keeps photos[i].src as the raw storage
  // path (or legacy base64) so the copy() call below can target the
  // bucket object directly instead of a signed URL we can't dereference.
  const loaded = await loadJournal(journalId, { resolveStoragePaths: false });
  const original = loaded.data;
  const copyTitle = `${original.tripTitle || "Untitled Journal"} (copy)`;
  const newId = await saveJournalMetadata(userId, null, {
    ...original,
    id: null,
    tripTitle: copyTitle,
    coverTitle: original.coverTitleEdited ? original.coverTitle : copyTitle,
  });

  // Storage objects are scoped to {userId}/{journalId}/ — the duplicate
  // needs its own copies so deleting the original doesn't break it.
  // Photos still in legacy base64 form get uploaded fresh; storage paths
  // are server-side copied to the new journal's folder.
  const copiedPhotos: Photo[] = await Promise.all(
    original.photos.map(async (p) => {
      if (isStoragePath(p.src)) {
        const newPath = `${userId}/${newId}/${p.id}.jpg`;
        const { error } = await supabase.storage
          .from(PHOTOS_BUCKET)
          .copy(p.src, newPath);
        if (error) throw error;
        return { ...p, src: newPath };
      }
      return p;
    }),
  );

  await syncJournalPhotos(userId, newId, {
    ...original,
    id: newId,
    tripTitle: copyTitle,
    coverTitle: original.coverTitleEdited ? original.coverTitle : copyTitle,
    photos: copiedPhotos,
  });
  return newId;
}

/**
 * Backwards-compatible full save (metadata + wholesale photos sync).
 * Still exported for callers that don't care about diffing.
 */
export async function saveJournal(userId: string, data: JournalData): Promise<string> {
  const journalId = await saveJournalMetadata(userId, data.id, data);
  await syncJournalPhotos(userId, journalId, { ...data, id: journalId });
  return journalId;
}
