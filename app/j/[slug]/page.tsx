import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import PublicJournalView from "@/app/components/PublicJournalView";
import { formatDate } from "@/app/lib/constants";
import type { Photo, VisualStyleKey, LayoutKey } from "@/app/lib/types";

export const revalidate = 3600;

interface PublicJournal {
  title: string;
  tripBrief: string;
  startDate: string | null;
  endDate: string | null;
  visualStyle: VisualStyleKey;
  layout: LayoutKey;
  coverTitle: string;
  coverSubtitle: string;
  photos: Photo[];
  coverPhotoId: number | null;
  publishedAt: string | null;
}

interface JournalRow {
  id: string;
  title: string | null;
  trip_brief: string | null;
  start_date: string | null;
  end_date: string | null;
  visual_style: string;
  layout: string;
  cover_title: string | null;
  cover_subtitle: string | null;
  published_at: string | null;
}

interface PhotoRow {
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

const SLUG_RE = /^[a-z0-9]{8}$/;

async function getPublicJournal(slug: string): Promise<PublicJournal | null> {
  if (!SLUG_RE.test(slug)) return null;
  const { data: journal, error } = await supabaseAdmin
    .from("journals")
    .select(
      "id, title, trip_brief, start_date, end_date, visual_style, layout, cover_title, cover_subtitle, published_at"
    )
    .eq("share_slug", slug)
    .eq("is_public", true)
    .maybeSingle<JournalRow>();
  if (error || !journal) return null;

  const { data: photoRows } = await supabaseAdmin
    .from("journal_photos")
    .select("src, caption, notes, paragraph, ai_caption, ai_notes, ai_paragraph, is_cover, photo_order")
    .eq("journal_id", journal.id)
    .order("photo_order", { ascending: true })
    .returns<PhotoRow[]>();

  const rows = photoRows ?? [];
  const photos: Photo[] = rows.map((p, i) => ({
    id: i + 1,
    src: p.src,
    caption: p.caption ?? "",
    notes: p.notes ?? "",
    paragraph: p.paragraph ?? "",
    aiCaption: p.ai_caption ?? "",
    aiNotes: p.ai_notes ?? "",
    aiParagraph: p.ai_paragraph ?? "",
  }));

  const coverIdx = rows.findIndex((p) => p.is_cover);
  const coverPhotoId = coverIdx >= 0 ? photos[coverIdx].id : null;

  return {
    title: journal.title ?? "",
    tripBrief: journal.trip_brief ?? "",
    startDate: journal.start_date,
    endDate: journal.end_date,
    visualStyle: (journal.visual_style || "editorial") as VisualStyleKey,
    layout: (journal.layout || "classic") as LayoutKey,
    coverTitle: journal.cover_title ?? "",
    coverSubtitle: journal.cover_subtitle ?? "",
    photos,
    coverPhotoId,
    publishedAt: journal.published_at,
  };
}

function buildDateDisplay(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  const s = start ? formatDate(new Date(start)) : "";
  const e = end ? formatDate(new Date(end)) : "";
  if (s && e) return `${s} — ${e}`;
  return s || e;
}

interface PageParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const journal = await getPublicJournal(slug);
  if (!journal) {
    return { title: "Journal not found — Waymark" };
  }
  const title = journal.title || "A Waymark Journal";
  const description = (journal.tripBrief || "A travel journal made with Waymark").slice(0, 160);
  return {
    title: `${title} — Waymark`,
    description,
    openGraph: {
      title,
      description,
      siteName: "Waymark",
      type: "article",
    },
  };
}

export default async function PublicJournalPage({ params }: PageParams) {
  const { slug } = await params;
  const journal = await getPublicJournal(slug);
  if (!journal) notFound();

  return (
    <PublicJournalView
      tripTitle={journal.title}
      tripBrief={journal.tripBrief}
      dateDisplay={buildDateDisplay(journal.startDate, journal.endDate)}
      photos={journal.photos}
      visualStyleKey={journal.visualStyle}
      layoutKey={journal.layout}
      coverPhotoId={journal.coverPhotoId}
      coverTitle={journal.coverTitle}
      coverSubtitle={journal.coverSubtitle}
    />
  );
}
