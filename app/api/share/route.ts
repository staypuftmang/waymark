import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

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

async function authedUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

interface ShareBody {
  journalId?: string;
  action?: "publish" | "unpublish";
}

export async function POST(req: Request) {
  const userId = await authedUserId(req);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: ShareBody;
  try {
    body = (await req.json()) as ShareBody;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const { journalId, action } = body;
  if (!journalId || (action !== "publish" && action !== "unpublish")) {
    return Response.json({ error: "invalid_params" }, { status: 400 });
  }

  const limit = checkShareLimit(userId);
  if (!limit.allowed) {
    return Response.json(
      { error: "rate_limited", resetInSeconds: limit.resetInSeconds },
      { status: 429 },
    );
  }

  const { data: journal, error: loadErr } = await supabaseAdmin
    .from("journals")
    .select("id, user_id, share_slug, is_public")
    .eq("id", journalId)
    .maybeSingle();
  if (loadErr || !journal) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (journal.user_id !== userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
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
      return Response.json({ error: "update_failed" }, { status: 500 });
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
    return Response.json({ error: "update_failed" }, { status: 500 });
  }
  if (journal.share_slug) revalidatePath(`/j/${journal.share_slug}`);
  return Response.json({ slug: journal.share_slug, isPublic: false });
}

export async function GET(req: Request) {
  const userId = await authedUserId(req);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const journalId = url.searchParams.get("journalId");
  if (!journalId) return Response.json({ error: "invalid_params" }, { status: 400 });

  const { data: journal, error } = await supabaseAdmin
    .from("journals")
    .select("id, user_id, share_slug, is_public")
    .eq("id", journalId)
    .maybeSingle();
  if (error || !journal) return Response.json({ error: "not_found" }, { status: 404 });
  if (journal.user_id !== userId) return Response.json({ error: "forbidden" }, { status: 403 });

  return Response.json({
    slug: journal.share_slug,
    isPublic: !!journal.is_public,
  });
}
