-- ─────────────────────────────────────────────────────────────────────────────
-- Add two missing indexes flagged by the architecture review.
--
-- 1. journals.share_slug — every /j/[slug] hit does
--    `select … from journals where share_slug = $1 and is_public = true`.
--    Without an index this is a sequential scan; the partial predicate
--    (`where share_slug is not null`) keeps the index small since most
--    journals are private and never get a slug.
--
-- 2. journal_photos (journal_id, photo_order) — every loadJournal does
--    `select … where journal_id = $1 order by photo_order`. The composite
--    index satisfies both the filter and the sort in one scan.
--
-- Both are additive and safe to run on a non-empty table; CONCURRENTLY is
-- omitted to keep the migration runnable inside a Supabase migration
-- transaction. Tables are still small.
-- ─────────────────────────────────────────────────────────────────────────────

create unique index if not exists journals_share_slug_idx
  on public.journals (share_slug)
  where share_slug is not null;

create index if not exists journal_photos_journal_order_idx
  on public.journal_photos (journal_id, photo_order);
