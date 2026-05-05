import { apiError, parseBody, withAuth, z } from "@/app/lib/api";
import { createHourlyLimiter, getClientIp } from "@/app/lib/hourlyLimiter";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

const HOURLY_LIMIT_AUTH = 10;
const HOURLY_LIMIT_ANON = 3;

// Independent counter from /api/feedback-upload — see route comment there.
const checkAndIncrement = createHourlyLimiter();

const FeedbackBodySchema = z.object({
  category: z.enum(["bug", "feature_request", "question", "other"]),
  message: z.string().min(1).max(4000),
  // Anon callers may include an email for follow-up; signed-in callers
  // have their email on file via the auth user, so we ignore it for them.
  email: z.string().email().optional().nullable(),
  page_url: z.string().optional().nullable(),
  user_agent: z.string().optional().nullable(),
  // The upload route returns absolute public URLs; we just trust + store
  // them. They're still bounded in number by MAX_ATTACHMENTS on the
  // client and by the upload route's per-call rate limit.
  attachments: z.array(z.string()).max(10).optional().nullable(),
});

/**
 * Hardened insert path for feedback rows. Replaces the previous
 * direct-from-browser supabase.from("feedback").insert(...), which let
 * any holder of the project's anon key flood the table.
 *
 * Flow:
 *   1. Optional auth (Bearer token). Determines the rate-limit tier and
 *      who the row gets attributed to — clients can't claim a different
 *      user_id.
 *   2. Tiered hourly rate limit (10/hr per user_id authed; 3/hr per IP
 *      anon).
 *   3. Body validation via Zod.
 *   4. Service-role insert. Migration 016 dropped the anon/auth INSERT
 *      policies so this is the only viable write path.
 *
 * Errors use the project's apiError envelope: rate_limited (429),
 * invalid_body (400), insert_failed (500).
 */
export const POST = withAuth(
  async (req, { userId }) => {
    const isAuthed = !!userId;
    const limitKey = isAuthed ? `u:${userId}` : `ip:${getClientIp(req)}`;
    const limit = isAuthed ? HOURLY_LIMIT_AUTH : HOURLY_LIMIT_ANON;
    const rl = checkAndIncrement(limitKey, limit);
    if (!rl.allowed) {
      return apiError(429, "rate_limited",
        isAuthed
          ? `Hourly feedback limit reached. Try again in ${Math.ceil(rl.resetInSeconds / 60)} minutes.`
          : "Too many submissions from this device. Sign in for a higher limit, or try again later.",
        {
          reset_in_seconds: rl.resetInSeconds,
          signed_in: isAuthed,
        },
      );
    }

    const parsed = await parseBody(req, FeedbackBodySchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const row = {
      // user_id comes from the verified auth context, never from the
      // body — clients can't spoof another user's id.
      user_id: userId,
      // Email field is only meaningful for anon (signed-in users have
      // their email in auth.users). Trim/normalise.
      email: !userId && body.email ? body.email.trim() : null,
      category: body.category,
      message: body.message.trim(),
      page_url: body.page_url ?? null,
      user_agent: body.user_agent ?? null,
      attachments: body.attachments && body.attachments.length > 0 ? body.attachments : null,
    };

    const { error } = await supabaseAdmin.from("feedback").insert(row);
    if (error) {
      console.error("Feedback insert failed:", error.message);
      return apiError(500, "insert_failed", "Couldn't save your feedback. Try again in a moment.");
    }

    return Response.json({ ok: true });
  },
  { required: false },
);
