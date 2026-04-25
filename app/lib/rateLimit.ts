import "server-only";
import { supabaseAdmin } from "./supabase-admin";

const errMsg = (e: unknown): string =>
  e instanceof Error ? e.message : "unknown";

export const HOURLY_LIMIT = 50;
export const DAILY_LIMIT = 200;

// Per-spec limits for the new per-journal layer
export const DAILY_JOURNAL_LIMIT = 10;
export const PER_JOURNAL_REWRITE_LIMIT = 30;
export const COOLDOWN_WINDOW_MS = 5 * 60 * 1000;
export const COOLDOWN_HITS = 10;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type ActionType = "journal_created" | "rewrite_single" | "rewrite_batch_photo";
const REWRITE_ACTIONS: ActionType[] = ["rewrite_single", "rewrite_batch_photo"];

export interface RateLimitInfo {
  allowed: boolean;
  hourlyUsed: number;
  hourlyRemaining: number;
  dailyUsed: number;
  dailyRemaining: number;
  resetInSeconds: number;
  limitType?: "hourly" | "daily";
}

export interface JournalCreationStatus {
  allowed: boolean;
  used: number;
  remaining: number;
  resetInSeconds: number;
}

export interface JournalRewriteStatus {
  allowed: boolean;
  used: number;
  remaining: number;
  cooldownActive: boolean;
  cooldownResetInSeconds: number;
  reason?: "cap" | "cooldown";
}

const failOpenLegacy = (): RateLimitInfo => ({
  allowed: true, hourlyUsed: 0, hourlyRemaining: HOURLY_LIMIT,
  dailyUsed: 0, dailyRemaining: DAILY_LIMIT, resetInSeconds: 0,
});

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
      return {
        allowed: false, hourlyUsed, hourlyRemaining, dailyUsed, dailyRemaining,
        resetInSeconds: oldest
          ? Math.max(1, Math.ceil((new Date(oldest.created_at).getTime() + DAY_MS - now) / 1000))
          : DAY_MS / 1000,
        limitType: "daily",
      };
    }
    if (hourlyUsed >= HOURLY_LIMIT) {
      const oldest = inHour[0];
      return {
        allowed: false, hourlyUsed, hourlyRemaining, dailyUsed, dailyRemaining,
        resetInSeconds: oldest
          ? Math.max(1, Math.ceil((new Date(oldest.created_at).getTime() + HOUR_MS - now) / 1000))
          : HOUR_MS / 1000,
        limitType: "hourly",
      };
    }
    return { allowed: true, hourlyUsed, hourlyRemaining, dailyUsed, dailyRemaining, resetInSeconds: 0 };
  } catch (e) {
    console.error("Rate limit check failed (failing open):", errMsg(e));
    return failOpenLegacy();
  }
}

/**
 * 10 journal_created events per user per 24h.
 */
export async function checkJournalCreationLimit(userId: string): Promise<JournalCreationStatus> {
  const now = Date.now();
  const dayAgoIso = new Date(now - DAY_MS).toISOString();
  try {
    const { data, error } = await supabaseAdmin
      .from("ai_usage")
      .select("created_at")
      .eq("user_id", userId)
      .eq("action_type", "journal_created")
      .gte("created_at", dayAgoIso)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as { created_at: string }[];
    const used = rows.length;
    const remaining = Math.max(0, DAILY_JOURNAL_LIMIT - used);
    if (used >= DAILY_JOURNAL_LIMIT) {
      const oldest = rows[0];
      return {
        allowed: false, used, remaining,
        resetInSeconds: oldest
          ? Math.max(1, Math.ceil((new Date(oldest.created_at).getTime() + DAY_MS - now) / 1000))
          : DAY_MS / 1000,
      };
    }
    return { allowed: true, used, remaining, resetInSeconds: 0 };
  } catch (e) {
    console.error("checkJournalCreationLimit failed (failing open):", errMsg(e));
    return { allowed: true, used: 0, remaining: DAILY_JOURNAL_LIMIT, resetInSeconds: 0 };
  }
}

/**
 * 30 total rewrites per journal AND 10-rewrites-per-5-minutes cooldown
 * on the same journal. Both gates need to clear.
 */
export async function checkJournalRewriteLimit(journalId: string): Promise<JournalRewriteStatus> {
  const now = Date.now();
  const cooldownAgoIso = new Date(now - COOLDOWN_WINDOW_MS).toISOString();
  try {
    const { data, error } = await supabaseAdmin
      .from("ai_usage")
      .select("created_at, action_type")
      .eq("journal_id", journalId)
      .in("action_type", REWRITE_ACTIONS)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as { created_at: string; action_type: string }[];
    const used = rows.length;
    const remaining = Math.max(0, PER_JOURNAL_REWRITE_LIMIT - used);
    const recent = rows.filter((r) => r.created_at >= cooldownAgoIso);
    const cooldownActive = recent.length >= COOLDOWN_HITS;
    let cooldownResetInSeconds = 0;
    if (cooldownActive) {
      const oldestRecent = recent[0];
      cooldownResetInSeconds = oldestRecent
        ? Math.max(1, Math.ceil((new Date(oldestRecent.created_at).getTime() + COOLDOWN_WINDOW_MS - now) / 1000))
        : Math.ceil(COOLDOWN_WINDOW_MS / 1000);
    }
    if (used >= PER_JOURNAL_REWRITE_LIMIT) {
      return { allowed: false, used, remaining, cooldownActive, cooldownResetInSeconds, reason: "cap" };
    }
    if (cooldownActive) {
      return { allowed: false, used, remaining, cooldownActive, cooldownResetInSeconds, reason: "cooldown" };
    }
    return { allowed: true, used, remaining, cooldownActive: false, cooldownResetInSeconds: 0 };
  } catch (e) {
    console.error("checkJournalRewriteLimit failed (failing open):", errMsg(e));
    return { allowed: true, used: 0, remaining: PER_JOURNAL_REWRITE_LIMIT, cooldownActive: false, cooldownResetInSeconds: 0 };
  }
}

export async function recordUsage(
  userId: string,
  actionType: ActionType,
  journalId: string | null,
): Promise<void> {
  try {
    await supabaseAdmin.from("ai_usage").insert({
      user_id: userId,
      action_type: actionType,
      journal_id: journalId,
    });
  } catch (e) {
    console.error("Failed to record AI usage:", errMsg(e));
  }
}

export async function maybeCleanup(): Promise<void> {
  if (Math.random() > 0.05) return;
  try {
    const cutoff = new Date(Date.now() - 2 * DAY_MS).toISOString();
    await supabaseAdmin.from("ai_usage").delete().lt("created_at", cutoff);
  } catch (e) {
    console.error("ai_usage cleanup failed:", errMsg(e));
  }
}
