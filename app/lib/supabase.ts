import { createClient } from "@supabase/supabase-js";

/**
 * Public Supabase client — safe to import in client components.
 * Uses the anon key, which is gated by Row Level Security on every table.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
  );
}

export const supabase = createClient(url, anonKey);
