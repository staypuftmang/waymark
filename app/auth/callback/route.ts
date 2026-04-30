import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * OAuth / magic-link callback. Supabase redirects the user here with a
 * short-lived `code` query param. We exchange it for a session and then
 * bounce the user back to the origin (or the `next` query param if set).
 *
 * NOTE: This uses the basic supabase-js client. It does NOT persist the
 * session as a cookie for SSR. When we wire up the auth UI and need
 * server-rendered authenticated pages, swap in `@supabase/ssr` and a
 * cookie-aware server client. For now the code-exchange itself succeeds
 * and the client side can pick up the resulting session from localStorage
 * via supabase.auth.getSession().
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  // Must be a single-leading-slash path: rejects "//evil.com", "/\evil.com",
  // protocol-relative URLs, and absolute URLs of any scheme.
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
