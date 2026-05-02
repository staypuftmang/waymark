import { supabase } from "./supabase";
import type { Photo, VisualStyleKey, WordStyleKey, LayoutKey, LengthKey } from "./types";

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
}

export interface LoadedJournal {
  data: JournalData;
  photoRemoteIds: Record<number, string>;
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

/**
 * Wholesale delete + reinsert of every journal_photos row for a journal.
 * Use only when photos are added, removed, reordered, or the cover assignment
 * changes. Returns a mapping from the client-side photo id to the new DB
 * UUIDs so callers can target individual rows for subsequent text updates.
 */
export async function syncJournalPhotos(
  journalId: string,
  data: JournalData,
): Promise<Record<number, string>> {
  const { error: delErr } = await supabase
    .from("journal_photos")
    .delete()
    .eq("journal_id", journalId);
  if (delErr) throw delErr;

  if (data.photos.length === 0) return {};

  const rows = data.photos.map((p, i) => photoInsertRow(journalId, p, i, data.coverPhotoId));
  const { data: inserted, error: insErr } = await supabase
    .from("journal_photos")
    .insert(rows)
    .select("id, photo_order");
  if (insErr) throw insErr;

  const byOrder: Record<number, string> = {};
  (inserted ?? []).forEach((r) => { byOrder[(r as { photo_order: number }).photo_order] = (r as { id: string }).id; });
  const map: Record<number, string> = {};
  data.photos.forEach((p, i) => {
    const remoteId = byOrder[i];
    if (remoteId) map[p.id] = remoteId;
  });
  return map;
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

export async function loadJournal(journalId: string): Promise<LoadedJournal> {
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

  const photoObjs: Photo[] = (photos ?? []).map((p, i) => ({
    id: i + 1,
    src: p.src,
    caption: p.caption ?? "",
    notes: p.notes ?? "",
    paragraph: p.paragraph ?? "",
    aiCaption: p.ai_caption ?? "",
    aiNotes: p.ai_notes ?? "",
    aiParagraph: p.ai_paragraph ?? "",
  }));

  const coverIdx = (photos ?? []).findIndex((p) => p.is_cover);
  const coverPhotoId = coverIdx >= 0 ? photoObjs[coverIdx].id : null;

  const photoRemoteIds: Record<number, string> = {};
  (photos ?? []).forEach((p, i) => { photoRemoteIds[photoObjs[i].id] = p.id; });

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
    },
    photoRemoteIds,
  };
}

export async function listJournals(userId: string): Promise<JournalSummary[]> {
  const { data, error } = await supabase
    .from("journals")
    .select(
      "id, title, mode, visual_style, layout, status, share_slug, is_public, created_at, updated_at, journal_photos(src, is_cover, photo_order)"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((j: unknown) => {
    const row = j as {
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
      journal_photos: { src: string; is_cover: boolean; photo_order: number }[] | null;
    };
    const photos = row.journal_photos ?? [];
    const cover = photos.find((p) => p.is_cover);
    const firstByOrder = [...photos].sort((a, b) => a.photo_order - b.photo_order)[0];
    return {
      id: row.id,
      title: row.title ?? "",
      mode: (row.mode === "full" ? "full" : "quick") as JournalMode,
      visualStyle: row.visual_style,
      layout: row.layout,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      coverPhotoSrc: cover?.src ?? firstByOrder?.src ?? null,
      isPublic: !!row.is_public,
      shareSlug: row.share_slug,
    };
  });
}

export async function deleteJournal(userId: string, journalId: string): Promise<void> {
  const { error } = await supabase
    .from("journals")
    .delete()
    .eq("id", journalId)
    .eq("user_id", userId);
  if (error) throw error;
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
  const loaded = await loadJournal(journalId);
  const original = loaded.data;
  const copyTitle = `${original.tripTitle || "Untitled Journal"} (copy)`;
  const copy: JournalData = {
    ...original,
    id: null,
    tripTitle: copyTitle,
    coverTitle: original.coverTitleEdited ? original.coverTitle : copyTitle,
  };
  const newId = await saveJournalMetadata(userId, null, copy);
  await syncJournalPhotos(newId, { ...copy, id: newId });
  return newId;
}

/**
 * Backwards-compatible full save (metadata + wholesale photos sync).
 * Still exported for callers that don't care about diffing.
 */
export async function saveJournal(userId: string, data: JournalData): Promise<string> {
  const journalId = await saveJournalMetadata(userId, data.id, data);
  await syncJournalPhotos(journalId, { ...data, id: journalId });
  return journalId;
}
