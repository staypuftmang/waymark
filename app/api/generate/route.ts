import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const PRIMARY_MODEL = "claude-sonnet-4-20250514";
const FALLBACK_MODEL = "claude-haiku-4-5-20251001";

// ── IP-based rate limiter ──
// 50 requests per hour + 200 per day. In-memory; resets on cold start.
interface RateLimitEntry {
  hourCount: number;
  hourResetAt: number;
  dayCount: number;
  dayResetAt: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const HOURLY_LIMIT = 50;
const DAILY_LIMIT = 200;

const rateLimitMap = new Map<string, RateLimitEntry>();

function checkRateLimit(ip: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);

  if (!entry) {
    entry = { hourCount: 0, hourResetAt: now + HOUR_MS, dayCount: 0, dayResetAt: now + DAY_MS };
    rateLimitMap.set(ip, entry);
  }

  if (now > entry.hourResetAt) {
    entry.hourCount = 0;
    entry.hourResetAt = now + HOUR_MS;
  }
  if (now > entry.dayResetAt) {
    entry.dayCount = 0;
    entry.dayResetAt = now + DAY_MS;
  }

  if (entry.dayCount >= DAILY_LIMIT) {
    return { allowed: false, reason: "daily" };
  }
  if (entry.hourCount >= HOURLY_LIMIT) {
    return { allowed: false, reason: "hourly" };
  }

  entry.hourCount++;
  entry.dayCount++;
  return { allowed: true };
}

// Periodic cleanup of expired entries
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
    // Normalize to one of the types Anthropic accepts
    let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";
    if (rawMediaType === "image/png") mediaType = "image/png";
    else if (rawMediaType === "image/gif") mediaType = "image/gif";
    else if (rawMediaType === "image/webp") mediaType = "image/webp";

    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data },
    });
  }

  content.push({ type: "text", text: prompt });
  return content;
}

export async function POST(req: Request) {
  // Rate limiting
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    const message = rateCheck.reason === "daily"
      ? "Daily generation limit reached. Try again tomorrow."
      : "You've been busy! Generation is temporarily paused. Try again in a few minutes.";
    return Response.json(
      { text: "", error: "rate_limited", reason: rateCheck.reason, message },
      { status: 429 }
    );
  }

  const { prompt, maxTokens = 1000, image } = await req.json();
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

    return Response.json({ text, model: PRIMARY_MODEL });
  } catch (e: unknown) {
    const status = (e as { status?: number }).status;

    // If overloaded (529) or rate limited (429), fall back to Haiku
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

        return Response.json({ text, model: FALLBACK_MODEL, fallback: true });
      } catch (fallbackErr) {
        console.error("Fallback model also failed:", fallbackErr);
        return Response.json({ text: "", error: "Both models unavailable", fallback: true }, { status: 503 });
      }
    }

    console.error("API generate error:", e);
    return Response.json({ text: "", error: "Generation failed" }, { status: 500 });
  }
}
