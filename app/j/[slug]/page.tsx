import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { cache } from "react";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { isStoragePath } from "@/app/lib/photoStorage";
import { getPublicPhotoUrl } from "@/app/lib/photoStorage.server";
import PublicJournalView from "@/app/components/PublicJournalView";
import { formatDate } from "@/app/lib/constants";
import type { Photo, VisualStyleKey, LayoutKey, LengthKey, Colophon } from "@/app/lib/types";

// Per-visit view tracking requires fresh execution on every request,
// otherwise inserts only fire on cache misses (~once per hour per slug)
// and the dashboard counts are off by orders of magnitude.
export const dynamic = "force-dynamic";

interface PublicJournal {
  id: string;
  ownerId: string;
  title: string;
  tripBrief: string;
  startDate: string | null;
  endDate: string | null;
  visualStyle: VisualStyleKey;
  layout: LayoutKey;
  length: LengthKey;
  coverTitle: string;
  coverSubtitle: string;
  photos: Photo[];
  coverPhotoId: number | null;
  publishedAt: string | null;
  colophon: Colophon | null;
}

interface JournalRow {
  id: string;
  user_id: string;
  title: string | null;
  trip_brief: string | null;
  start_date: string | null;
  end_date: string | null;
  visual_style: string;
  layout: string;
  length: string | null;
  cover_title: string | null;
  cover_subtitle: string | null;
  published_at: string | null;
  colophon: Colophon | null;
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

// Cached per-request via React cache() so generateMetadata + the page
// component share a single Supabase fetch.
const getPublicJournal = cache(async (slug: string): Promise<PublicJournal | null> => {
  if (!SLUG_RE.test(slug)) return null;
  const { data: journal, error } = await supabaseAdmin
    .from("journals")
    .select(
      "id, user_id, title, trip_brief, start_date, end_date, visual_style, layout, length, cover_title, cover_subtitle, published_at, colophon"
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
  const resolvedSrcs: string[] = await Promise.all(
    rows.map(async (p) => {
      if (isStoragePath(p.src)) {
        try {
          return await getPublicPhotoUrl(p.src);
        } catch (err) {
          console.warn(`Failed to sign public photo URL for ${p.src}:`, err);
          return p.src;
        }
      }
      return p.src;
    }),
  );
  const photos: Photo[] = rows.map((p, i) => ({
    id: i + 1,
    src: resolvedSrcs[i],
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
    id: journal.id,
    ownerId: journal.user_id,
    title: journal.title ?? "",
    tripBrief: journal.trip_brief ?? "",
    startDate: journal.start_date,
    endDate: journal.end_date,
    visualStyle: (journal.visual_style || "editorial") as VisualStyleKey,
    layout: (journal.layout || "classic") as LayoutKey,
    length: (journal.length || "standard") as LengthKey,
    coverTitle: journal.cover_title ?? "",
    coverSubtitle: journal.cover_subtitle ?? "",
    photos,
    coverPhotoId,
    publishedAt: journal.published_at,
    colophon: journal.colophon ?? null,
  };
});

/**
 * Best-effort fire-and-forget view tracking. Failures are logged but never
 * surface to the visitor — the page render must not block on the insert,
 * and an analytics outage shouldn't break the share link.
 *
 * Skip rules:
 *   1. *.vercel.app preview deploys (per spec — only the production
 *      domain should accumulate stats).
 *   2. Owner self-views, when the request carries a Supabase Bearer
 *      token whose user_id matches the journal owner. Note: Waymark's
 *      auth uses localStorage, not cookies, so a logged-in owner
 *      browsing to /j/[slug] doesn't actually send this header. The
 *      check fires for explicit fetch()-style API access — for
 *      browser-based owner views we'd need cookie-based sessions.
 */
async function trackView(journalId: string, ownerId: string): Promise<void> {
  try {
    const h = await headers();
    const host = h.get("host") ?? "";
    if (host.includes("vercel.app")) return;

    const auth = h.get("authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice(7).trim();
      if (token) {
        const { data } = await supabaseAdmin.auth.getUser(token);
        if (data.user?.id === ownerId) return;
      }
    }

    await supabaseAdmin.from("journal_views").insert({
      journal_id: journalId,
      referrer: h.get("referer") ?? null,
      country: h.get("x-vercel-ip-country") ?? null,
      city: h.get("x-vercel-ip-city") ?? null,
      user_agent: h.get("user-agent") ?? null,
    });
  } catch (err) {
    console.warn("Failed to record journal view:", err);
  }
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

  // Tracking is fire-and-forget but awaited here to keep the visit row's
  // server-side execution scoped to this request — a Vercel function may
  // freeze immediately after the response is returned.
  await trackView(journal.id, journal.ownerId);

  return (
    <PublicJournalView
      tripTitle={journal.title}
      tripBrief={journal.tripBrief}
      dateDisplay={buildDateDisplay(journal.startDate, journal.endDate)}
      photos={journal.photos}
      visualStyleKey={journal.visualStyle}
      layoutKey={journal.layout}
      length={journal.length}
      coverPhotoId={journal.coverPhotoId}
      coverTitle={journal.coverTitle}
      coverSubtitle={journal.coverSubtitle}
      colophon={journal.colophon}
    />
  );
}
