import { supabaseAdmin } from "@/app/lib/supabase-admin";
import {
  checkUserRateLimit,
  checkJournalCreationLimit,
  checkJournalRewriteLimit,
  HOURLY_LIMIT,
  DAILY_LIMIT,
  DAILY_JOURNAL_LIMIT,
  PER_JOURNAL_REWRITE_LIMIT,
} from "@/app/lib/rateLimit";

/**
 * Probe the user's current AI rate-limit status without consuming a
 * generation. Pass ?journal=<uuid> to also get the per-journal counts.
 * Anon callers get { signedIn: false }.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return Response.json({ signedIn: false });
  }
  const token = auth.slice(7).trim();
  if (!token) return Response.json({ signedIn: false });

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return Response.json({ signedIn: false });
    const userId = data.user.id;
    const url = new URL(req.url);
    const journalId = url.searchParams.get("journal");

    const [umbrella, journals, rewrites] = await Promise.all([
      checkUserRateLimit(userId),
      checkJournalCreationLimit(userId),
      journalId ? checkJournalRewriteLimit(journalId) : Promise.resolve(null),
    ]);

    return Response.json({
      signedIn: true,
      hourlyRemaining: umbrella.hourlyRemaining,
      dailyRemaining: umbrella.dailyRemaining,
      hourlyLimit: HOURLY_LIMIT,
      dailyLimit: DAILY_LIMIT,
      journalsUsed: journals.used,
      journalsRemaining: journals.remaining,
      journalLimit: DAILY_JOURNAL_LIMIT,
      ...(rewrites
        ? {
            journalRewritesUsed: rewrites.used,
            journalRewritesRemaining: rewrites.remaining,
            journalRewriteLimit: PER_JOURNAL_REWRITE_LIMIT,
            cooldownActive: rewrites.cooldownActive,
            cooldownRemainingSeconds: rewrites.cooldownResetInSeconds,
          }
        : {}),
    });
  } catch (e) {
    console.error("rate-limit probe failed:", e instanceof Error ? e.message : "unknown");
    return Response.json({ signedIn: false });
  }
}
