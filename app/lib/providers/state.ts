import "server-only";
import { supabaseAdmin } from "../supabase-admin";

export type Provider = "anthropic" | "google";

interface CacheEntry {
  status: "healthy" | "degraded";
  cachedAt: number;
}

// In-memory cache of last-known status per provider, scoped to the warm
// instance. Bounds the cost of state tracking on the hot path: a Claude
// success on a healthy provider costs zero DB roundtrips while the cache
// is fresh. STATUS_TTL_MS bounds how long a stale cache can mask a
// recovery transition that another instance already wrote.
const STATUS_TTL_MS = 30_000;
const cache = new Map<Provider, CacheEntry>();

function isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
  return !!entry && Date.now() - entry.cachedAt < STATUS_TTL_MS;
}

/**
 * Record a successful call on `provider`. If the provider was previously
 * 'degraded' in the DB, atomically flip it to 'healthy' and emit a
 * 'provider_recovered' alert. If our cache shows fresh-healthy, the work
 * is skipped entirely. Fire-and-forget; the caller does not await.
 */
export function recordProviderSuccess(provider: Provider): void {
  const cached = cache.get(provider);
  if (isFresh(cached) && cached.status === "healthy") return;
  void runRecovery(provider);
}

async function runRecovery(provider: Provider): Promise<void> {
  try {
    const now = new Date().toISOString();
    // Atomic transition: only flips degraded → healthy. The returning
    // row tells us we won the race so we know to write exactly one alert.
    const { data } = await supabaseAdmin
      .from("provider_status")
      .update({ status: "healthy", last_recovery: now, updated_at: now })
      .eq("provider", provider)
      .eq("status", "degraded")
      .select("provider")
      .maybeSingle();
    if (data) {
      await supabaseAdmin.from("alerts").insert({
        event_type: "provider_recovered",
        original_provider: provider,
        fallback_provider: null,
        error_message: null,
      });
      console.log(`[provider_recovered] ${provider}`);
    }
    cache.set(provider, { status: "healthy", cachedAt: Date.now() });
  } catch (err) {
    console.warn("recordProviderSuccess failed:", err);
  }
}

/**
 * Record a failure on `provider` that was masked by `fallbackProvider`
 * (or null if no fallback succeeded). On a healthy → degraded transition,
 * emits a 'fallback_activated' alert. Fire-and-forget.
 */
export function recordProviderFailure(
  provider: Provider,
  errorMessage: string,
  fallbackProvider: Provider | null,
): void {
  void runFailure(provider, errorMessage, fallbackProvider);
}

async function runFailure(
  provider: Provider,
  errorMessage: string,
  fallbackProvider: Provider | null,
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const { data } = await supabaseAdmin
      .from("provider_status")
      .update({ status: "degraded", last_failure: now, updated_at: now })
      .eq("provider", provider)
      .eq("status", "healthy")
      .select("provider")
      .maybeSingle();
    if (data) {
      await supabaseAdmin.from("alerts").insert({
        event_type: "fallback_activated",
        original_provider: provider,
        fallback_provider: fallbackProvider,
        error_message: errorMessage.slice(0, 500),
      });
      console.log(
        `[fallback_activated] ${provider} → ${fallbackProvider ?? "none"} (${errorMessage.slice(0, 200)})`,
      );
    }
    cache.set(provider, { status: "degraded", cachedAt: Date.now() });
  } catch (err) {
    console.warn("recordProviderFailure failed:", err);
  }
}
