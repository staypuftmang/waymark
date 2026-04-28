import { supabase } from "./supabase";

export type AiActionType = "journal_created" | "rewrite_single" | "rewrite_batch_photo" | "trip_brief_generate";
export type RateLimitType =
  | "hourly"
  | "daily"
  | "journal_creation"
  | "journal_rewrites"
  | "cooldown";

export interface RateLimitErrorInfo {
  resetInSeconds: number;
  limitType: RateLimitType;
  signedIn: boolean;
  message: string;
  journalsUsed?: number;
  journalsRemaining?: number;
  journalRewritesUsed?: number;
  journalRewritesRemaining?: number;
  cooldownRemainingSeconds?: number;
}

export interface RateLimitStatus {
  signedIn: boolean;
  hourlyRemaining?: number;
  dailyRemaining?: number;
  journalsUsed?: number;
  journalsRemaining?: number;
  journalRewritesUsed?: number;
  journalRewritesRemaining?: number;
  cooldownActive?: boolean;
  cooldownRemainingSeconds?: number;
}

export interface AiResult {
  text: string;
  fallback?: boolean;
  error?: string;
  reason?: string;
  message?: string;
  rate_limit?: RateLimitStatus;
}

let onFallbackUsed: (() => void) | null = null;
let onRateLimited: ((info: RateLimitErrorInfo) => void) | null = null;
let onRateStatus: ((status: RateLimitStatus) => void) | null = null;

export function setFallbackListener(fn: (() => void) | null) { onFallbackUsed = fn; }
export function setRateLimitListener(fn: ((info: RateLimitErrorInfo) => void) | null) { onRateLimited = fn; }
export function setRateStatusListener(fn: ((status: RateLimitStatus) => void) | null) { onRateStatus = fn; }

async function authHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export interface AiCallOptions {
  actionType?: AiActionType;
  /** Pass the current journal id (when known) so per-journal limits apply. */
  journalId?: string | null;
  /** When false, the server runs the AI call but skips inserting a usage row. */
  record?: boolean;
  /** When false, suppress the rate-limit listener (caller wants to handle quietly). */
  surfaceRateLimit?: boolean;
}

export interface AiCallExtra {
  /** Multiple images, in order. Takes precedence over `image` if both passed. */
  images?: string[];
  /** Override max output tokens (default 1000). */
  maxTokens?: number;
}

export async function aiCall(
  prompt: string,
  image?: string,
  opts: AiCallOptions & AiCallExtra = {},
): Promise<string> {
  const maxRetries = 2;
  const actionType = opts.actionType ?? "rewrite_single";
  const journalId = opts.journalId ?? null;
  const record = opts.record !== false;
  const surface = opts.surfaceRateLimit !== false;
  const images = opts.images;
  const maxTokens = opts.maxTokens ?? 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const auth = await authHeader();
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ prompt, maxTokens, image, images, actionType, journalId, record }),
      });

      if (r.status === 429) {
        try {
          const d = await r.json();
          if (surface && onRateLimited) {
            const lt = (["hourly", "daily", "journal_creation", "journal_rewrites", "cooldown"] as const)
              .find((x) => x === d.limit_type) ?? "daily";
            onRateLimited({
              resetInSeconds: Number(d.reset_in_seconds) || 0,
              limitType: lt,
              signedIn: !!d.signed_in,
              message: d.message || "Generation limit reached.",
              journalsUsed: d.journals_used,
              journalsRemaining: d.journals_remaining,
              journalRewritesUsed: d.journal_rewrites_used,
              journalRewritesRemaining: d.journal_rewrites_remaining,
              cooldownRemainingSeconds: d.cooldown_remaining_seconds,
            });
          }
        } catch {
          if (surface && onRateLimited) {
            onRateLimited({
              resetInSeconds: 0, limitType: "hourly", signedIn: false,
              message: "Generation limit reached. Try again later.",
            });
          }
        }
        return "";
      }

      if (!r.ok) {
        console.warn(`AI call failed (attempt ${attempt + 1}): status ${r.status}`);
        if (attempt < maxRetries) {
          await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
          continue;
        }
        return "";
      }

      const d: AiResult = await r.json();
      if (d.fallback && onFallbackUsed) onFallbackUsed();
      if (d.rate_limit && onRateStatus) onRateStatus(d.rate_limit);
      return d.text || "";
    } catch (e) {
      console.warn(`AI call error (attempt ${attempt + 1}):`, e);
      if (attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
        continue;
      }
      return "";
    }
  }

  return "";
}

/**
 * Probe the rate-limit endpoint without consuming an action. Pass a
 * journalId to also fetch per-journal counts.
 */
export async function fetchRateStatus(journalId?: string | null): Promise<RateLimitStatus | null> {
  try {
    const auth = await authHeader();
    if (!auth.Authorization) return null;
    const url = journalId
      ? `/api/rate-limit?journal=${encodeURIComponent(journalId)}`
      : "/api/rate-limit";
    const r = await fetch(url, { headers: auth });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j.signedIn) return null;
    const status: RateLimitStatus = {
      signedIn: true,
      hourlyRemaining: j.hourlyRemaining,
      dailyRemaining: j.dailyRemaining,
      journalsUsed: j.journalsUsed,
      journalsRemaining: j.journalsRemaining,
      journalRewritesUsed: j.journalRewritesUsed,
      journalRewritesRemaining: j.journalRewritesRemaining,
      cooldownActive: j.cooldownActive,
      cooldownRemainingSeconds: j.cooldownRemainingSeconds,
    };
    if (onRateStatus) onRateStatus(status);
    return status;
  } catch (e) {
    console.warn("Failed to fetch rate status:", e);
    return null;
  }
}
