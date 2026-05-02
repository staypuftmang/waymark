import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { apiError, parseBody, withAuth, z } from "@/app/lib/api";

const SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

// In-memory share rate limit: 20 share/unshare actions per user per hour.
// Resets on server restart; acceptable trade-off for an abuse cap that
// doesn't need cross-instance accuracy.
const SHARE_LIMIT = 20;
const SHARE_WINDOW_MS = 60 * 60 * 1000;
const shareHits = new Map<string, number[]>();

function checkShareLimit(userId: string): { allowed: boolean; resetInSeconds: number } {
  const now = Date.now();
  const cutoff = now - SHARE_WINDOW_MS;
  const hits = (shareHits.get(userId) ?? []).filter((t) => t > cutoff);
  if (hits.length >= SHARE_LIMIT) {
    const resetInSeconds = Math.max(1, Math.ceil((hits[0] + SHARE_WINDOW_MS - now) / 1000));
    shareHits.set(userId, hits);
    return { allowed: false, resetInSeconds };
  }
  hits.push(now);
  shareHits.set(userId, hits);
  return { allowed: true, resetInSeconds: 0 };
}

function generateSlug(): string {
  // Rejection sampling on cryptographic random bytes to avoid the small
  // modulo bias of `bytes[i] % 36`. We pull more bytes than needed and
  // skip any that fall outside the largest multiple of 36 ≤ 256.
  const LIMIT = 252; // 36 * 7 — largest multiple of 36 ≤ 255
  let slug = "";
  while (slug.length < 8) {
    const bytes = randomBytes(16);
    for (let i = 0; i < bytes.length && slug.length < 8; i++) {
      const b = bytes[i];
      if (b < LIMIT) slug += SLUG_CHARS.charAt(b % SLUG_CHARS.length);
    }
  }
  return slug;
}

async function generateUniqueSlug(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = generateSlug();
    const { data } = await supabaseAdmin
      .from("journals")
      .select("id")
      .eq("share_slug", slug)
      .maybeSingle();
    if (!data) return slug;
  }
  throw new Error("Could not generate unique slug");
}

const ShareBodySchema = z.object({
  journalId: z.string().min(1),
  action: z.enum(["publish", "unpublish"]),
});

export const POST = withAuth(async (req, { userId }) => {
  // userId is non-null here — withAuth defaults to required.
  const parsed = await parseBody(req, ShareBodySchema);
  if (!parsed.ok) return parsed.response;
  const { journalId, action } = parsed.data;

  const limit = checkShareLimit(userId!);
  if (!limit.allowed) {
    return apiError(429, "rate_limited", "Too many share actions — try again shortly.", {
      resetInSeconds: limit.resetInSeconds,
    });
  }

  const { data: journal, error: loadErr } = await supabaseAdmin
    .from("journals")
    .select("id, user_id, share_slug, is_public")
    .eq("id", journalId)
    .maybeSingle();
  if (loadErr || !journal) {
    return apiError(404, "not_found", "Journal not found.");
  }
  if (journal.user_id !== userId) {
    return apiError(403, "forbidden", "You don't own this journal.");
  }

  if (action === "publish") {
    const slug = journal.share_slug || (await generateUniqueSlug());
    const { error: updErr } = await supabaseAdmin
      .from("journals")
      .update({
        share_slug: slug,
        is_public: true,
        published_at: new Date().toISOString(),
      })
      .eq("id", journalId);
    if (updErr) {
      return apiError(500, "update_failed", "Failed to publish journal.");
    }
    revalidatePath(`/j/${slug}`);
    return Response.json({ slug, isPublic: true });
  }

  // unpublish: keep slug, set is_public = false
  const { error: updErr } = await supabaseAdmin
    .from("journals")
    .update({ is_public: false })
    .eq("id", journalId);
  if (updErr) {
    return apiError(500, "update_failed", "Failed to unpublish journal.");
  }
  if (journal.share_slug) revalidatePath(`/j/${journal.share_slug}`);
  return Response.json({ slug: journal.share_slug, isPublic: false });
});

export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url);
  const journalId = url.searchParams.get("journalId");
  if (!journalId) {
    return apiError(400, "invalid_params", "journalId query parameter is required.");
  }

  const { data: journal, error } = await supabaseAdmin
    .from("journals")
    .select("id, user_id, share_slug, is_public")
    .eq("id", journalId)
    .maybeSingle();
  if (error || !journal) return apiError(404, "not_found", "Journal not found.");
  if (journal.user_id !== userId) return apiError(403, "forbidden", "You don't own this journal.");

  return Response.json({
    slug: journal.share_slug,
    isPublic: !!journal.is_public,
  });
});
