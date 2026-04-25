import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { checkUserRateLimit, HOURLY_LIMIT, DAILY_LIMIT } from "@/app/lib/rateLimit";

/**
 * Probe the user's current AI rate-limit status without consuming a
 * generation. Returns { signedIn: false } for anon callers — anon usage
 * lives in memory on the route worker and isn't useful to expose.
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

    const status = await checkUserRateLimit(data.user.id);
    return Response.json({
      signedIn: true,
      hourlyRemaining: status.hourlyRemaining,
      dailyRemaining: status.dailyRemaining,
      hourlyLimit: HOURLY_LIMIT,
      dailyLimit: DAILY_LIMIT,
    });
  } catch (e) {
    console.error("rate-limit probe failed:", e);
    return Response.json({ signedIn: false });
  }
}
