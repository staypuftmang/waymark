-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 — Defense-in-depth anon-read policies for public journals.
--
-- Public sharing currently relies on supabaseAdmin (service role) to read
-- shared journals; this migration adds a parallel RLS path so the anon
-- key works too, in case a future code path bypasses the admin client.
-- Reads are still gated by `is_public = true` so only opted-in journals
-- are exposed.
-- ─────────────────────────────────────────────────────────────────────────────

create policy "journals: select if public"
on public.journals for select
to anon
using (is_public = true);

create policy "journal_photos: select if parent public"
on public.journal_photos for select
to anon
using (
  exists (
    select 1 from public.journals j
    where j.id = journal_photos.journal_id and j.is_public = true
  )
);
