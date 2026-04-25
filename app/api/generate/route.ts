import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import {
  checkUserRateLimit,
  checkJournalCreationLimit,
  checkJournalRewriteLimit,
  recordUsage,
  maybeCleanup,
  HOURLY_LIMIT,
  DAILY_LIMIT,
  type ActionType,
} from "@/app/lib/rateLimit";

const client = new Anthropic();

const PRIMARY_MODEL = "claude-sonnet-4-20250514";
const FALLBACK_MODEL = "claude-haiku-4-5-20251001";

// ── IP-based rate limiter (signed-out fallback) ──
interface RateLimitEntry {
  hourCount: number;
  hourResetAt: number;
  dayCount: number;
  dayResetAt: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const rateLimitMap = new Map<string, RateLimitEntry>();

interface IpCheckResult {
  allowed: boolean;
  reason?: "hourly" | "daily";
  resetInSeconds?: number;
  hourlyRemaining: number;
  dailyRemaining: number;
}

function checkIpRateLimit(ip: string): IpCheckResult {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry) {
    entry = { hourCount: 0, hourResetAt: now + HOUR_MS, dayCount: 0, dayResetAt: now + DAY_MS };
    rateLimitMap.set(ip, entry);
  }
  if (now > entry.hourResetAt) { entry.hourCount = 0; entry.hourResetAt = now + HOUR_MS; }
  if (now > entry.dayResetAt) { entry.dayCount = 0; entry.dayResetAt = now + DAY_MS; }
  const hourlyRemaining = Math.max(0, HOURLY_LIMIT - entry.hourCount);
  const dailyRemaining = Math.max(0, DAILY_LIMIT - entry.dayCount);
  if (entry.dayCount >= DAILY_LIMIT) {
    return { allowed: false, reason: "daily",
      resetInSeconds: Math.max(1, Math.ceil((entry.dayResetAt - now) / 1000)),
      hourlyRemaining, dailyRemaining };
  }
  if (entry.hourCount >= HOURLY_LIMIT) {
    return { allowed: false, reason: "hourly",
      resetInSeconds: Math.max(1, Math.ceil((entry.hourResetAt - now) / 1000)),
      hourlyRemaining, dailyRemaining };
  }
  return { allowed: true, hourlyRemaining: hourlyRemaining - 1, dailyRemaining: dailyRemaining - 1 };
}

function recordIpUsage(ip: string) {
  const entry = rateLimitMap.get(ip);
  if (!entry) return;
  entry.hourCount++;
  entry.dayCount++;
}

if (typeof globalThis !== "undefined") {
  const g = globalThis as unknown as { __waymarkRateCleanup?: boolean };
  if (!g.__waymarkRateCleanup) {
    g.__waymarkRateCleanup = true;
    setInterval(() => {
      const now = Date.now();
      for (const [ip, entry] of rateLimitMap.entries()) {
        if (now > entry.dayResetAt) rateLimitMap.delete(ip);
      }
    }, 5 * 60 * 1000);
  }
}

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

async function getUserIdFromAuth(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch (e) {
    console.error("Failed to verify auth token:", e instanceof Error ? e.message : "unknown");
    return null;
  }
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } };

function buildContent(prompt: string, image?: string): ContentBlock[] {
  const content: ContentBlock[] = [];
  if (image && image.startsWith("data:")) {
    const commaIdx = image.indexOf(",");
    const header = image.slice(0, commaIdx);
    const data = image.slice(commaIdx + 1);
    const mediaTypeMatch = header.match(/data:([^;]+)/);
    const rawMediaType = mediaTypeMatch ? mediaTypeMatch[1] : "image/jpeg";
    let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";
    if (rawMediaType === "image/png") mediaType = "image/png";
    else if (rawMediaType === "image/gif") mediaType = "image/gif";
    else if (rawMediaType === "image/webp") mediaType = "image/webp";
    content.push({ type: "image", source: { type: "base64", media_type: mediaType, data } });
  }
  content.push({ type: "text", text: prompt });
  return content;
}

const VALID_ACTIONS: ActionType[] = ["journal_created", "rewrite_single", "rewrite_batch_photo"];

export async function POST(req: Request) {
  const userId = await getUserIdFromAuth(req);
  const body = await req.json();
  const { prompt, maxTokens = 1000, image } = body;
  const actionType: ActionType = (VALID_ACTIONS.includes(body.actionType)
    ? body.actionType
    : "rewrite_single") as ActionType;
  const journalId: string | null = typeof body.journalId === "string" && body.journalId ? body.journalId : null;
  const record: boolean = body.record !== false;

  // Layered rate-limit checks (signed-in only). Each layer fails open if
  // its own Supabase query fails — see rateLimit.ts.
  if (userId) {
    maybeCleanup();

    // Legacy umbrella check — keeps 50/hr + 200/day per user as a safety net.
    const umbrella = await checkUserRateLimit(userId);
    if (!umbrella.allowed) {
      return Response.json({
        text: "", error: "rate_limited",
        limit_type: umbrella.limitType,
        reset_in_seconds: umbrella.resetInSeconds,
        signed_in: true,
        message: umbrella.limitType === "daily"
          ? "Daily generation limit reached."
          : "Hourly generation limit reached.",
      }, { status: 429 });
    }

    if (actionType === "journal_created" && record) {
      const j = await checkJournalCreationLimit(userId);
      if (!j.allowed) {
        return Response.json({
          text: "", error: "rate_limited",
          limit_type: "journal_creation",
          journals_used: j.used,
          journals_remaining: j.remaining,
          reset_in_seconds: j.resetInSeconds,
          signed_in: true,
          message: `Daily journal limit reached. You've created ${j.used} journals today. Your limit resets tomorrow. You can still edit your existing journals and download them.`,
        }, { status: 429 });
      }
    } else if (actionType === "rewrite_single" || actionType === "rewrite_batch_photo") {
      if (journalId) {
        const r = await checkJournalRewriteLimit(journalId);
        if (!r.allowed) {
          if (r.reason === "cap") {
            return Response.json({
              text: "", error: "rate_limited",
              limit_type: "journal_rewrites",
              journal_rewrites_used: r.used,
              journal_rewrites_remaining: r.remaining,
              signed_in: true,
              message: "All rewrites used for this journal. You've used all 30 AI rewrites on this journal. You can still edit text manually. Tip: Duplicate this journal to get a fresh set of rewrites.",
            }, { status: 429 });
          }
          // cooldown
          return Response.json({
            text: "", error: "rate_limited",
            limit_type: "cooldown",
            cooldown_remaining_seconds: r.cooldownResetInSeconds,
            journal_rewrites_used: r.used,
            journal_rewrites_remaining: r.remaining,
            signed_in: true,
            message: "AI is cooling down. Try again in a moment.",
          }, { status: 429 });
        }
      }
    }
  } else {
    const ip = getClientIp(req);
    const ipCheck = checkIpRateLimit(ip);
    if (!ipCheck.allowed) {
      return Response.json({
        text: "", error: "rate_limited",
        limit_type: ipCheck.reason,
        reset_in_seconds: ipCheck.resetInSeconds ?? 0,
        signed_in: false,
        message: "You've reached the generation limit. Sign in for a higher limit and to save your journals.",
      }, { status: 429 });
    }
  }

  const content = buildContent(prompt, image);

  const runWith = async (model: string) => {
    const message = await client.messages.create({
      model, max_tokens: maxTokens, messages: [{ role: "user", content }],
    });
    return message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((b) => b.text).join("").trim();
  };

  // Build a usage-status payload for the client to update its UI without
  // a follow-up probe.
  async function buildResponseMeta() {
    const meta: Record<string, unknown> = { signedIn: !!userId };
    if (userId) {
      // Refresh counts now that we (may have) recorded a row.
      const u = await checkUserRateLimit(userId);
      meta.hourlyRemaining = u.hourlyRemaining;
      meta.dailyRemaining = u.dailyRemaining;
      const jc = await checkJournalCreationLimit(userId);
      meta.journalsUsed = jc.used;
      meta.journalsRemaining = jc.remaining;
      if (journalId) {
        const r = await checkJournalRewriteLimit(journalId);
        meta.journalRewritesUsed = r.used;
        meta.journalRewritesRemaining = r.remaining;
        meta.cooldownActive = r.cooldownActive;
        meta.cooldownRemainingSeconds = r.cooldownResetInSeconds;
      }
    }
    return meta;
  }

  try {
    let text = "";
    let model = PRIMARY_MODEL;
    let fallback = false;
    try {
      text = await runWith(PRIMARY_MODEL);
    } catch (e: unknown) {
      const status = (e as { status?: number }).status;
      if (status === 529 || status === 429) {
        console.warn(`Primary model ${PRIMARY_MODEL} unavailable (${status}), falling back to ${FALLBACK_MODEL}`);
        text = await runWith(FALLBACK_MODEL);
        model = FALLBACK_MODEL;
        fallback = true;
      } else {
        throw e;
      }
    }

    if (userId && record) {
      await recordUsage(userId, actionType, journalId);
    } else if (!userId) {
      recordIpUsage(getClientIp(req));
    }

    const rate_limit = await buildResponseMeta();
    return Response.json({ text, model, ...(fallback ? { fallback: true } : {}), rate_limit });
  } catch (e) {
    console.error("API generate error:", e instanceof Error ? e.message : "unknown");
    return Response.json({ text: "", error: "Generation failed" }, { status: 500 });
  }
}
