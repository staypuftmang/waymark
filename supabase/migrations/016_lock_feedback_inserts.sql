-- ─────────────────────────────────────────────────────────────────────────────
-- Lock down public.feedback inserts.
--
-- Migration 006 left INSERT open to anon (with check user_id is null) and
-- authenticated. That meant anyone holding the project's anon key — which
-- is shipped in every page bundle — could flood the table from a script,
-- bypassing the per-IP rate limit applied to attachment uploads.
--
-- All inserts now route through /api/feedback-submit, which applies the
-- same tiered hourly rate limit as /api/feedback-upload (3/hr per IP for
-- anon, 10/hr per user_id for authenticated) before forwarding to the
-- table with the service-role client. Service role bypasses RLS, so
-- dropping these two policies leaves the route as the only viable
-- write path.
--
-- No SELECT / UPDATE / DELETE policies exist on this table, so reads
-- remain service-role-only — unchanged from migration 006.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "feedback: insert anon" on public.feedback;
drop policy if exists "feedback: insert authenticated" on public.feedback;
