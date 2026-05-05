-- ─────────────────────────────────────────────────────────────────────────────
-- Lock down the Feedback-Attachments bucket.
--
-- Migration 007 left INSERT open to both anon and authenticated roles so the
-- client could upload directly. That means anyone with the project's anon
-- key (which is shipped in every page bundle) could write arbitrary files
-- into the bucket — no MIME check, no size cap, no rate limit.
--
-- All uploads now route through /api/feedback-upload, which validates and
-- rate-limits before forwarding to Storage with the service-role client.
-- Service role bypasses RLS, so dropping these two insert policies leaves
-- the route as the only viable write path.
--
-- The public-read policy stays untouched — feedback screenshots remain
-- viewable by URL the same way they were before.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Feedback-Attachments: anon insert" on storage.objects;
drop policy if exists "Feedback-Attachments: auth insert" on storage.objects;
