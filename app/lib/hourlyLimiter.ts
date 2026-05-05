import "server-only";

const HOUR_MS = 60 * 60 * 1000;

interface Entry {
  count: number;
  resetAt: number;
}

export interface LimitResult {
  allowed: boolean;
  resetInSeconds: number;
}

/**
 * Per-route hourly rate limiter, in-memory and warm-instance scoped.
 * Multiple Vercel instances each get their own counter, so the effective
 * cap is up to N × limit during traffic spikes — the same trade-off
 * /api/generate makes. Acceptable for the feedback widget's traffic
 * profile; spec is "no Redis at this scale".
 *
 * Each call to createHourlyLimiter returns a fresh closure with its own
 * Map, so different routes have independent counters (an anon user that
 * burns through their feedback-submit budget can still upload a
 * screenshot, and vice versa).
 *
 * Stale entries get replaced lazily when their key is next checked; the
 * map can grow unbounded if abandoned IPs pile up, but for realistic
 * traffic the size stays in the thousands at most.
 */
export function createHourlyLimiter(): (key: string, limit: number) => LimitResult {
  const map = new Map<string, Entry>();
  return (key, limit) => {
    const now = Date.now();
    let e = map.get(key);
    if (!e || now >= e.resetAt) {
      e = { count: 0, resetAt: now + HOUR_MS };
      map.set(key, e);
    }
    if (e.count >= limit) {
      return {
        allowed: false,
        resetInSeconds: Math.max(1, Math.ceil((e.resetAt - now) / 1000)),
      };
    }
    e.count += 1;
    return { allowed: true, resetInSeconds: 0 };
  };
}

/** Best-effort client IP from edge proxy headers. Used as the rate-limit
 *  key for anonymous callers. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
