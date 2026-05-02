import Anthropic from "@anthropic-ai/sdk";
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
import { apiError, parseBody, withAuth, z } from "@/app/lib/api";
import { acquireSlot, releaseSlot } from "@/app/lib/concurrency";

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

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } }
  | { type: "image"; source: { type: "url"; url: string } };

function pushImageBlock(content: ContentBlock[], image: string): void {
  if (!image) return;
  // Storage-backed photos arrive as signed Supabase URLs after the
  // base64 → Storage migration. Anthropic's vision API supports a `url`
  // image source, so we forward the URL and let Anthropic fetch it.
  if (image.startsWith("http://") || image.startsWith("https://")) {
    content.push({ type: "image", source: { type: "url", url: image } });
    return;
  }
  if (!image.startsWith("data:")) return;
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

function buildContent(prompt: string, image?: string, images?: string[]): ContentBlock[] {
  const content: ContentBlock[] = [];
  if (Array.isArray(images) && images.length > 0) {
    images.forEach((img) => pushImageBlock(content, img));
  } else if (image) {
    pushImageBlock(content, image);
  }
  content.push({ type: "text", text: prompt });
  return content;
}

const VALID_ACTIONS = ["journal_created", "rewrite_single", "rewrite_batch_photo", "trip_brief_generate"] as const;

const GenerateBodySchema = z.object({
  prompt: z.string(),
  maxTokens: z.number().int().positive().optional(),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
  actionType: z.string().optional(),
  journalId: z.string().nullable().optional(),
  record: z.boolean().optional(),
});

export const POST = withAuth(
  async (req, { userId }) => {
    const parsed = await parseBody(req, GenerateBodySchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const prompt = body.prompt;
    const maxTokens = body.maxTokens ?? 1000;
    const image = body.image;
    const images = body.images;
    const actionType: ActionType = (VALID_ACTIONS as readonly string[]).includes(body.actionType ?? "")
      ? (body.actionType as ActionType)
      : "rewrite_single";
    const journalId: string | null = typeof body.journalId === "string" && body.journalId ? body.journalId : null;
    const record: boolean = body.record !== false;

    // Layered rate-limit checks (signed-in only). Each layer fails open if
    // its own Supabase query fails — see rateLimit.ts.
    if (userId) {
      maybeCleanup();

      // Legacy umbrella check — keeps 50/hr + 200/day per user as a safety net.
      const umbrella = await checkUserRateLimit(userId);
      if (!umbrella.allowed) {
        return apiError(429, "rate_limited",
          umbrella.limitType === "daily"
            ? "Daily generation limit reached."
            : "Hourly generation limit reached.",
          {
            limit_type: umbrella.limitType,
            reset_in_seconds: umbrella.resetInSeconds,
            signed_in: true,
          },
        );
      }

      if (actionType === "journal_created" && record) {
        const j = await checkJournalCreationLimit(userId);
        if (!j.allowed) {
          return apiError(429, "rate_limited",
            `Daily journal limit reached. You've created ${j.used} journals today. Your limit resets tomorrow. You can still edit your existing journals and download them.`,
            {
              limit_type: "journal_creation",
              journals_used: j.used,
              journals_remaining: j.remaining,
              reset_in_seconds: j.resetInSeconds,
              signed_in: true,
            },
          );
        }
      } else if (actionType === "rewrite_single" || actionType === "rewrite_batch_photo") {
        if (journalId) {
          const r = await checkJournalRewriteLimit(journalId);
          if (!r.allowed) {
            if (r.reason === "cap") {
              return apiError(429, "rate_limited",
                "All rewrites used for this journal. You've used all 30 AI rewrites on this journal. You can still edit text manually. Tip: Duplicate this journal to get a fresh set of rewrites.",
                {
                  limit_type: "journal_rewrites",
                  journal_rewrites_used: r.used,
                  journal_rewrites_remaining: r.remaining,
                  signed_in: true,
                },
              );
            }
            return apiError(429, "rate_limited",
              "AI is cooling down. Try again in a moment.",
              {
                limit_type: "cooldown",
                cooldown_remaining_seconds: r.cooldownResetInSeconds,
                journal_rewrites_used: r.used,
                journal_rewrites_remaining: r.remaining,
                signed_in: true,
              },
            );
          }
        }
      }
    } else {
      const ip = getClientIp(req);
      const ipCheck = checkIpRateLimit(ip);
      if (!ipCheck.allowed) {
        return apiError(429, "rate_limited",
          "You've reached the generation limit. Sign in for a higher limit and to save your journals.",
          {
            limit_type: ipCheck.reason,
            reset_in_seconds: ipCheck.resetInSeconds ?? 0,
            signed_in: false,
          },
        );
      }
    }

    const content = buildContent(prompt, image, Array.isArray(images) ? images : undefined);

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

    // Server-wide concurrency cap. If the warm instance already has 20
    // Anthropic calls in flight, we 503 the new one rather than pile on
    // and risk tripping Anthropic's org-level rate limits.
    if (!acquireSlot()) {
      return apiError(503, "server_busy",
        "Our AI is handling a lot of requests right now. Please try again in a few seconds.",
      );
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
      return apiError(500, "generation_failed", "Generation failed");
    } finally {
      // Always release — covers success, fallback, primary error, and
      // every other path through the inner try/catch.
      releaseSlot();
    }
  },
  { required: false },
);
