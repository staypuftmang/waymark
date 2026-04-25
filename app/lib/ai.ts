import { supabase } from "./supabase";

export type AiActionType = "generate" | "rewrite" | "rewrite_all";

export interface RateLimitErrorInfo {
  resetInSeconds: number;
  limitType: "hourly" | "daily";
  signedIn: boolean;
  message: string;
}

export interface RateLimitStatus {
  hourlyRemaining: number;
  dailyRemaining: number;
  signedIn: boolean;
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

export function setFallbackListener(fn: (() => void) | null) {
  onFallbackUsed = fn;
}

export function setRateLimitListener(fn: ((info: RateLimitErrorInfo) => void) | null) {
  onRateLimited = fn;
}

export function setRateStatusListener(fn: ((status: RateLimitStatus) => void) | null) {
  onRateStatus = fn;
}

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
  /**
   * If true, a 429 is reported via the rate-limit listener (default).
   * Set false for callers that want to handle the 429 quietly themselves
   * (e.g. partial-batch flows that already know they're at the wall).
   */
  surfaceRateLimit?: boolean;
}

export async function aiCall(
  prompt: string,
  image?: string,
  opts: AiCallOptions = {},
): Promise<string> {
  const maxRetries = 2;
  const actionType = opts.actionType ?? "generate";
  const surface = opts.surfaceRateLimit !== false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const auth = await authHeader();
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ prompt, maxTokens: 1000, image, actionType }),
      });

      if (r.status === 429) {
        try {
          const d = await r.json();
          if (surface && onRateLimited) {
            onRateLimited({
              resetInSeconds: Number(d.reset_in_seconds) || 0,
              limitType: d.limit_type === "hourly" ? "hourly" : "daily",
              signedIn: !!d.signed_in,
              message: d.message || "Generation limit reached.",
            });
          }
        } catch {
          if (surface && onRateLimited) {
            onRateLimited({
              resetInSeconds: 0,
              limitType: "hourly",
              signedIn: false,
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
 * Probe the rate-limit endpoint without consuming an action — used by the UI
 * to display "X generations remaining today" hints. Returns null if the
 * server doesn't surface the info (e.g. signed-out + first request).
 */
export async function fetchRateStatus(): Promise<RateLimitStatus | null> {
  // No dedicated endpoint yet; the status updates ride on every successful
  // aiCall response. The UI seeds from those.
  return null;
}
