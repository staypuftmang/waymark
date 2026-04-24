import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses Row Level Security — use ONLY in
 * route handlers, server actions, or other server-only code.
 *
 * The `import "server-only"` directive above will cause a build-time error
 * if anything imports this from a client component.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY in .env.local."
  );
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
