import { supabase } from "./supabase";
import type { Photo, VisualStyleKey, WordStyleKey, LayoutKey } from "./types";

export interface JournalData {
  id: string | null;
  tripTitle: string;
  tripBrief: string;
  startDate: string | null; // ISO yyyy-mm-dd
  endDate: string | null;
  visualStyle: VisualStyleKey;
  wordStyle: WordStyleKey;
  layout: LayoutKey;
  coverPhotoId: number | string | null;
  coverTitle: string;
  coverSubtitle: string;
  coverTitleEdited: boolean;
  photos: Photo[];
}

export interface JournalSummary {
  id: string;
  title: string;
  visualStyle: string;
  layout: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  coverPhotoSrc: string | null;
}

interface JournalRow {
  id: string;
  title: string | null;
  trip_brief: string | null;
  start_date: string | null;
  end_date: string | null;
  visual_style: string;
  word_style: string;
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

function journalToFields(d: JournalData) {
  return {
    title: d.tripTitle,
    trip_brief: d.tripBrief,
    start_date: d.startDate,
    end_date: d.endDate,
    visual_style: d.visualStyle,
    word_style: d.wordStyle,
    layout: d.layout,
    cover_photo_id: d.coverPhotoId != null ? String(d.coverPhotoId) : null,
    cover_title: d.coverTitle,
    cover_subtitle: d.coverSubtitle,
    cover_title_edited: d.coverTitleEdited,
  };
}

function photoRows(journalId: string, d: JournalData) {
  return d.photos.map((p, i) => ({
    journal_id: journalId,
    photo_order: i,
    src: p.src,
    caption: p.caption || "",
    notes: p.notes || "",
    paragraph: p.paragraph || "",
    ai_caption: p.aiCaption || "",
    ai_notes: p.aiNotes || "",
    ai_paragraph: p.aiParagraph || "",
    is_cover: d.coverPhotoId != null && String(p.id) === String(d.coverPhotoId),
  }));
}

export function isEmptyJournal(d: JournalData): boolean {
  return !d.tripTitle.trim() && !d.tripBrief.trim() && d.photos.length === 0;
}

/**
 * Upsert a journal. Returns the journal id. Creates a new journal row if
 * `data.id` is null, otherwise updates the existing row. Replaces the
 * photos for the journal wholesale (simpler than diffing).
 */
export async function saveJournal(userId: string, data: JournalData): Promise<string> {
  const fields = journalToFields(data);
  let journalId = data.id;

  if (journalId) {
    const { error: updateError } = await supabase
      .from("journals")
      .update(fields)
      .eq("id", journalId)
      .eq("user_id", userId);
    if (updateError) throw updateError;
  } else {
    const { data: row, error: insertError } = await supabase
      .from("journals")
      .insert({ user_id: userId, ...fields })
      .select("id")
      .single();
    if (insertError) throw insertError;
    journalId = row.id as string;
  }

  // Replace photos
  const { error: delError } = await supabase
    .from("journal_photos")
    .delete()
    .eq("journal_id", journalId);
  if (delError) throw delError;

  if (data.photos.length > 0) {
    const { error: insPhotosError } = await supabase
      .from("journal_photos")
      .insert(photoRows(journalId, data));
    if (insPhotosError) throw insPhotosError;
  }

  return journalId;
}

export async function loadJournal(journalId: string): Promise<JournalData> {
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

  // Map photo rows back to the in-memory Photo[] shape. Use the row's
  // numeric photo_order as the client-side id so the UI's numeric id
  // logic (drag-and-drop keys, cover matching) keeps working.
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

  return {
    id: journal.id,
    tripTitle: journal.title ?? "",
    tripBrief: journal.trip_brief ?? "",
    startDate: journal.start_date,
    endDate: journal.end_date,
    visualStyle: (journal.visual_style || "editorial") as VisualStyleKey,
    wordStyle: (journal.word_style || "poetic") as WordStyleKey,
    layout: (journal.layout || "classic") as LayoutKey,
    coverPhotoId,
    coverTitle: journal.cover_title ?? "",
    coverSubtitle: journal.cover_subtitle ?? "",
    coverTitleEdited: !!journal.cover_title_edited,
    photos: photoObjs,
  };
}

export async function listJournals(userId: string): Promise<JournalSummary[]> {
  const { data, error } = await supabase
    .from("journals")
    .select(
      "id, title, visual_style, layout, status, created_at, updated_at, journal_photos(src, is_cover, photo_order)"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((j: unknown) => {
    const row = j as {
      id: string;
      title: string | null;
      visual_style: string;
      layout: string;
      status: string;
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
      visualStyle: row.visual_style,
      layout: row.layout,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      coverPhotoSrc: cover?.src ?? firstByOrder?.src ?? null,
    };
  });
}

export async function deleteJournal(journalId: string): Promise<void> {
  const { error } = await supabase.from("journals").delete().eq("id", journalId);
  if (error) throw error;
}

export async function renameJournal(journalId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from("journals")
    .update({ title })
    .eq("id", journalId);
  if (error) throw error;
}

export async function duplicateJournal(userId: string, journalId: string): Promise<string> {
  const original = await loadJournal(journalId);
  const copyTitle = `${original.tripTitle || "Untitled Journal"} (copy)`;
  const copy: JournalData = {
    ...original,
    id: null,
    tripTitle: copyTitle,
    coverTitle: original.coverTitleEdited ? original.coverTitle : copyTitle,
  };
  return saveJournal(userId, copy);
}
