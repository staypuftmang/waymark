/**
 * In-memory, per-instance concurrency limiter for outbound AI requests.
 *
 * Lives at module scope so the counter persists across requests served by
 * the same warm Vercel function instance. Each instance has its own
 * counter — meaning the effective server-wide cap is `MAX_CONCURRENT ×
 * (number of warm instances)`. That's an acceptable best-effort safety
 * valve for the current scale: the goal is to stop a single hot instance
 * from torching Anthropic's org-level rate limits during a burst, not
 * precise global throttling. When traffic grows past one or two
 * instances we'd reach for a Redis-backed counter (or move concurrency
 * to a queue) rather than try to make this exact.
 *
 * Cold-start naturally resets the counter to 0. That's also fine — a
 * fresh instance has no in-flight work by definition.
 */

const MAX_CONCURRENT = 20;

let inFlight = 0;

/**
 * Try to claim one of the {@link MAX_CONCURRENT} slots. Returns true on
 * success (caller MUST eventually call {@link releaseSlot}); returns
 * false when the cap is already reached.
 */
export function acquireSlot(): boolean {
  if (inFlight >= MAX_CONCURRENT) return false;
  inFlight++;
  return true;
}

/**
 * Release a previously-acquired slot. Safe to call from a `finally` block —
 * if `inFlight` is already 0 (somehow over-released) this no-ops rather
 * than going negative.
 */
export function releaseSlot(): void {
  if (inFlight > 0) inFlight--;
}

/** Test/diagnostic accessor — returns the current in-flight count. */
export function currentInFlight(): number {
  return inFlight;
}

/** Test-only reset hook. Not exported in production paths. */
export function __resetForTests(): void {
  inFlight = 0;
}

export const CONCURRENCY_LIMIT = MAX_CONCURRENT;
