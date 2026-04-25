import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import {
  checkUserRateLimit,
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
// 50 requests per hour + 200 per day. In-memory; resets on cold start.
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
    return {
      allowed: false, reason: "daily",
      resetInSeconds: Math.max(1, Math.ceil((entry.dayResetAt - now) / 1000)),
      hourlyRemaining, dailyRemaining,
    };
  }
  if (entry.hourCount >= HOURLY_LIMIT) {
    return {
      allowed: false, reason: "hourly",
      resetInSeconds: Math.max(1, Math.ceil((entry.hourResetAt - now) / 1000)),
      hourlyRemaining, dailyRemaining,
    };
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
    console.error("Failed to verify auth token:", e);
    return null;
  }
}

// ── Build Anthropic message content from prompt + optional image ──
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

export async function POST(req: Request) {
  const userId = await getUserIdFromAuth(req);
  const body = await req.json();
  const { prompt, maxTokens = 1000, image } = body;
  const actionType: ActionType = (["generate", "rewrite", "rewrite_all"].includes(body.actionType)
    ? body.actionType
    : "generate") as ActionType;

  // Rate limit: per-user when signed in, IP-based otherwise.
  let rateLimitMeta: { hourlyRemaining: number; dailyRemaining: number; signedIn: boolean };

  if (userId) {
    maybeCleanup();
    const check = await checkUserRateLimit(userId);
    if (!check.allowed) {
      return Response.json(
        {
          text: "",
          error: "rate_limited",
          limit_type: check.limitType,
          reset_in_seconds: check.resetInSeconds,
          hourly_remaining: check.hourlyRemaining,
          daily_remaining: check.dailyRemaining,
          signed_in: true,
          message: check.limitType === "daily"
            ? "Daily generation limit reached."
            : "Hourly generation limit reached.",
        },
        { status: 429 }
      );
    }
    rateLimitMeta = {
      hourlyRemaining: check.hourlyRemaining,
      dailyRemaining: check.dailyRemaining,
      signedIn: true,
    };
  } else {
    const ip = getClientIp(req);
    const ipCheck = checkIpRateLimit(ip);
    if (!ipCheck.allowed) {
      return Response.json(
        {
          text: "",
          error: "rate_limited",
          limit_type: ipCheck.reason,
          reset_in_seconds: ipCheck.resetInSeconds ?? 0,
          hourly_remaining: ipCheck.hourlyRemaining,
          daily_remaining: ipCheck.dailyRemaining,
          signed_in: false,
          message: ipCheck.reason === "daily"
            ? "Daily generation limit reached. Sign in to get more generations."
            : "You've been busy! Try again in a few minutes, or sign in to get more generations.",
        },
        { status: 429 }
      );
    }
    rateLimitMeta = {
      hourlyRemaining: ipCheck.hourlyRemaining,
      dailyRemaining: ipCheck.dailyRemaining,
      signedIn: false,
    };
    // Reserve one slot up front. We'll record usage on success below.
  }

  const content = buildContent(prompt, image);

  // Try primary model first
  try {
    const message = await client.messages.create({
      model: PRIMARY_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content }],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    // Record usage on success
    if (userId) {
      recordUsage(userId, actionType);
      // Decrement remaining counters in our response since we just consumed one
      rateLimitMeta.hourlyRemaining = Math.max(0, rateLimitMeta.hourlyRemaining - 1);
      rateLimitMeta.dailyRemaining = Math.max(0, rateLimitMeta.dailyRemaining - 1);
    } else {
      recordIpUsage(getClientIp(req));
    }

    return Response.json({
      text,
      model: PRIMARY_MODEL,
      rate_limit: rateLimitMeta,
    });
  } catch (e: unknown) {
    const status = (e as { status?: number }).status;

    if (status === 529 || status === 429) {
      console.warn(`Primary model ${PRIMARY_MODEL} unavailable (${status}), falling back to ${FALLBACK_MODEL}`);
      try {
        const message = await client.messages.create({
          model: FALLBACK_MODEL,
          max_tokens: maxTokens,
          messages: [{ role: "user", content }],
        });
        const text = message.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("")
          .trim();

        if (userId) {
          recordUsage(userId, actionType);
          rateLimitMeta.hourlyRemaining = Math.max(0, rateLimitMeta.hourlyRemaining - 1);
          rateLimitMeta.dailyRemaining = Math.max(0, rateLimitMeta.dailyRemaining - 1);
        } else {
          recordIpUsage(getClientIp(req));
        }

        return Response.json({
          text, model: FALLBACK_MODEL, fallback: true, rate_limit: rateLimitMeta,
        });
      } catch (fallbackErr) {
        console.error("Fallback model also failed:", fallbackErr);
        return Response.json({ text: "", error: "Both models unavailable", fallback: true }, { status: 503 });
      }
    }

    console.error("API generate error:", e);
    return Response.json({ text: "", error: "Generation failed" }, { status: 500 });
  }
}
