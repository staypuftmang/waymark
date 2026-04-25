import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Public Supabase client — safe to import in client components.
 * Uses the anon key, which is gated by Row Level Security on every table.
 *
 * Initialized lazily so importing this module during Next's
 * prerender/build step doesn't require the env vars to be present at
 * that exact moment. Anything that actually calls a method on the
 * client triggers the env check at runtime.
 */

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (and in Vercel for deployed envs)."
    );
  }
  _client = createClient(url, anonKey);
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
