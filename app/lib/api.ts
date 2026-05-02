import { z, type ZodSchema } from "zod";
import { supabaseAdmin } from "./supabase-admin";

// ─────────────────────────────────────────────────────────────────────────────
// Error responses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard error response shape used by every route:
 *   { error: <stable machine code>, message: <human-readable string>, ...extra }
 *
 * `code` is what the client switches on; `message` is what the UI shows.
 * `extra` carries route-specific metadata that doesn't fit the base shape
 * (rate-limit counters, sub-codes like `limit_type`, etc.).
 */
export function apiError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return Response.json({ error: code, message, ...(extra ?? {}) }, { status });
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth wrapper
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthContext {
  /** Resolved Supabase user id, or null when auth is optional and missing. */
  userId: string | null;
}

export interface WithAuthOptions {
  /** When false, missing/invalid tokens resolve to userId: null instead of
   * returning 401. Used by routes (like /api/generate) that fall back to
   * IP-based behaviour for anonymous callers. Defaults to true. */
  required?: boolean;
}

type AuthedHandler = (req: Request, ctx: AuthContext) => Promise<Response> | Response;

async function resolveUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch (e) {
    console.error("Failed to verify auth token:", e instanceof Error ? e.message : "unknown");
    return null;
  }
}

/**
 * Wrap a route handler so it doesn't have to reimplement auth-header
 * parsing. The handler receives the resolved `userId` (or null when
 * auth is optional and the caller is anonymous).
 *
 *   export const POST = withAuth((req, { userId }) => { ... });
 *   export const GET = withAuth(async (req, { userId }) => { ... }, { required: false });
 */
export function withAuth(handler: AuthedHandler, opts: WithAuthOptions = {}) {
  const required = opts.required !== false;
  return async (req: Request): Promise<Response> => {
    const userId = await resolveUserId(req);
    if (required && !userId) {
      return apiError(401, "unauthorized", "Sign in to access this endpoint.");
    }
    return handler(req, { userId });
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Body parsing
// ─────────────────────────────────────────────────────────────────────────────

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

/**
 * Parse and validate a JSON request body against a Zod schema. On success
 * returns `{ ok: true, data }`. On failure returns `{ ok: false, response }`
 * holding a 400 apiError with the Zod issues attached as `extra.issues`.
 *
 *   const parsed = await parseBody(req, MySchema);
 *   if (!parsed.ok) return parsed.response;
 *   const body = parsed.data;
 */
export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: apiError(400, "invalid_body", "Request body is not valid JSON."),
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: apiError(400, "invalid_body", "Request body failed validation.", {
        issues: result.error.issues,
      }),
    };
  }
  return { ok: true, data: result.data };
}

// Re-export z so consumers don't have to import it separately.
export { z };
