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
import { withAuth } from "@/app/lib/api";

/**
 * Probe the user's current AI rate-limit status without consuming a
 * generation. Pass ?journal=<uuid> to also get the per-journal counts.
 * Anon callers get { signedIn: false }.
 *
 * Uses withAuth({ required: false }) — the route resolves the user when
 * a Bearer token is present, but never returns 401. Anon and unauthorized
 * callers both fall through to the same `{ signedIn: false }` payload
 * the client UI already handles.
 */
export const GET = withAuth(
  async (req, { userId }) => {
    if (!userId) return Response.json({ signedIn: false });

    try {
      const url = new URL(req.url);
      const journalId = url.searchParams.get("journal");

      let ownedJournalId: string | null = null;
      if (journalId) {
        const { data: row } = await supabaseAdmin
          .from("journals")
          .select("user_id")
          .eq("id", journalId)
          .maybeSingle();
        if (row && (row as { user_id: string }).user_id === userId) {
          ownedJournalId = journalId;
        }
      }

      const [umbrella, journals, rewrites] = await Promise.all([
        checkUserRateLimit(userId),
        checkJournalCreationLimit(userId),
        ownedJournalId ? checkJournalRewriteLimit(ownedJournalId) : Promise.resolve(null),
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
  },
  { required: false },
);
