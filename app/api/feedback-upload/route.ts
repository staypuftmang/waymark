import { apiError, withAuth } from "@/app/lib/api";
import { createHourlyLimiter, getClientIp } from "@/app/lib/hourlyLimiter";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

const BUCKET = "Feedback-Attachments";
const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  // Some platforms (older Android cameras, certain Windows tools) emit the
  // non-standard "image/jpg" — accept it; downstream readers all decode it
  // as JPEG anyway.
  "image/jpg",
  "image/gif",
  "image/webp",
]);

const HOURLY_LIMIT_AUTH = 10;
const HOURLY_LIMIT_ANON = 3;

// Independent counter from /api/feedback-submit so an anon user that
// burns through their submit budget can still attach a screenshot to the
// next valid submit, and vice versa.
const checkAndIncrement = createHourlyLimiter();

function safeExt(name: string, mime: string): string {
  const dot = name.lastIndexOf(".");
  if (dot >= 0) {
    const fromName = name.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toLowerCase();
    if (fromName) return fromName;
  }
  // Fall back to deriving extension from MIME type.
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function uniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Hardened upload endpoint for feedback attachments. Replaces the
 * previous direct-from-browser upload, which let any holder of the
 * anon key write arbitrary files into the bucket.
 *
 * Flow:
 *   1. Optional auth (Bearer token). userId presence picks the rate-
 *      limit tier and the storage folder.
 *   2. Rate-limit check (10/hr per user, 3/hr per IP).
 *   3. Multipart parse — single "file" field expected.
 *   4. MIME and size validation.
 *   5. Service-role upload to Storage. Bucket RLS no longer permits
 *      anon/auth writes after migration 015, so this is the only
 *      write path.
 *   6. Return the public URL.
 *
 * Errors use the project's apiError envelope so the client can switch
 * on `error` codes: rate_limited (429), file_too_large (413),
 * invalid_mime (415), invalid_body (400), upload_failed (500).
 */
export const POST = withAuth(
  async (req, { userId }) => {
    // Rate-limit BEFORE we read the body so a flood of large uploads
    // can't pin the route on bytes-in-flight.
    const isAuthed = !!userId;
    const limitKey = isAuthed ? `u:${userId}` : `ip:${getClientIp(req)}`;
    const limit = isAuthed ? HOURLY_LIMIT_AUTH : HOURLY_LIMIT_ANON;
    const rl = checkAndIncrement(limitKey, limit);
    if (!rl.allowed) {
      return apiError(429, "rate_limited",
        isAuthed
          ? `Hourly upload limit reached. Try again in ${Math.ceil(rl.resetInSeconds / 60)} minutes.`
          : "Too many uploads from this device. Sign in for a higher limit, or try again later.",
        {
          reset_in_seconds: rl.resetInSeconds,
          signed_in: isAuthed,
        },
      );
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return apiError(400, "invalid_body", "Expected multipart/form-data with a 'file' field.");
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return apiError(400, "invalid_body", "Missing 'file' field.");
    }

    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return apiError(415, "invalid_mime",
        "That file type isn't supported. Upload a PNG, JPG, GIF, or WebP image.",
      );
    }

    if (file.size > MAX_BYTES) {
      return apiError(413, "file_too_large",
        `Files must be 5 MB or smaller — that one is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
      );
    }

    const ext = safeExt(file.name, mime);
    const folder = userId ?? "anon";
    const path = `${folder}/${uniqueId()}.${ext}`;

    // ArrayBuffer → Uint8Array so the supabase-js storage client can
    // hand the bytes to fetch() without re-reading the File object.
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: mime === "image/jpg" ? "image/jpeg" : mime,
        upsert: false,
      });
    if (upErr) {
      console.error("Feedback upload failed:", upErr.message);
      return apiError(500, "upload_failed", "Couldn't save that image. Try again in a moment.");
    }

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      return apiError(500, "upload_failed", "Couldn't generate a URL for that image.");
    }

    return Response.json({ url: data.publicUrl });
  },
  { required: false },
);
