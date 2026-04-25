import "server-only";
import { supabaseAdmin } from "./supabase-admin";

export const HOURLY_LIMIT = 50;
export const DAILY_LIMIT = 200;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type ActionType = "generate" | "rewrite" | "rewrite_all";

export interface RateLimitInfo {
  allowed: boolean;
  hourlyUsed: number;
  hourlyRemaining: number;
  dailyUsed: number;
  dailyRemaining: number;
  resetInSeconds: number;
  limitType?: "hourly" | "daily";
}

const failOpen = (): RateLimitInfo => ({
  allowed: true,
  hourlyUsed: 0,
  hourlyRemaining: HOURLY_LIMIT,
  dailyUsed: 0,
  dailyRemaining: DAILY_LIMIT,
  resetInSeconds: 0,
});

/**
 * Check whether `userId` may run another AI action right now. Returns the
 * current usage counters either way. On any Supabase failure (timeout,
 * network, RLS edge case) we FAIL OPEN — the request goes through. We'd
 * rather over-serve than block a legitimate user because of an outage.
 */
export async function checkUserRateLimit(userId: string): Promise<RateLimitInfo> {
  const now = Date.now();
  const hourAgoIso = new Date(now - HOUR_MS).toISOString();
  const dayAgoIso = new Date(now - DAY_MS).toISOString();

  try {
    const { data, error } = await supabaseAdmin
      .from("ai_usage")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", dayAgoIso)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as { created_at: string }[];
    const inHour = rows.filter((r) => r.created_at >= hourAgoIso);
    const dailyUsed = rows.length;
    const hourlyUsed = inHour.length;
    const hourlyRemaining = Math.max(0, HOURLY_LIMIT - hourlyUsed);
    const dailyRemaining = Math.max(0, DAILY_LIMIT - dailyUsed);

    if (dailyUsed >= DAILY_LIMIT) {
      const oldest = rows[0];
      const resetInSeconds = oldest
        ? Math.max(1, Math.ceil((new Date(oldest.created_at).getTime() + DAY_MS - now) / 1000))
        : DAY_MS / 1000;
      return {
        allowed: false,
        hourlyUsed, hourlyRemaining, dailyUsed, dailyRemaining,
        resetInSeconds,
        limitType: "daily",
      };
    }

    if (hourlyUsed >= HOURLY_LIMIT) {
      const oldest = inHour[0];
      const resetInSeconds = oldest
        ? Math.max(1, Math.ceil((new Date(oldest.created_at).getTime() + HOUR_MS - now) / 1000))
        : HOUR_MS / 1000;
      return {
        allowed: false,
        hourlyUsed, hourlyRemaining, dailyUsed, dailyRemaining,
        resetInSeconds,
        limitType: "hourly",
      };
    }

    return {
      allowed: true,
      hourlyUsed, hourlyRemaining, dailyUsed, dailyRemaining,
      resetInSeconds: 0,
    };
  } catch (e) {
    console.error("Rate limit check failed (failing open):", e);
    return failOpen();
  }
}

export async function recordUsage(userId: string, actionType: ActionType): Promise<void> {
  try {
    await supabaseAdmin.from("ai_usage").insert({ user_id: userId, action_type: actionType });
  } catch (e) {
    console.error("Failed to record AI usage:", e);
  }
}

/**
 * Probabilistic best-effort cleanup: deletes rows older than 48h. Called
 * with ~5% probability from the hot path so we don't need a separate cron.
 */
export async function maybeCleanup(): Promise<void> {
  if (Math.random() > 0.05) return;
  try {
    const cutoff = new Date(Date.now() - 2 * DAY_MS).toISOString();
    await supabaseAdmin.from("ai_usage").delete().lt("created_at", cutoff);
  } catch (e) {
    console.error("ai_usage cleanup failed:", e);
  }
}
