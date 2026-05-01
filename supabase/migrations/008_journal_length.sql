-- ─────────────────────────────────────────────────────────────────────────────
-- Add `length` column to journals.
--
-- Captures the LENGTH selection from Quick Create (brief / standard / detailed)
-- so saved journals remember it for re-rendering and so the rewrite-all popover
-- in edit mode can change it without starting over.
--
-- Default is "standard" so existing rows match the prior behavior.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.journals
  add column if not exists length text not null default 'standard';

-- Constrain to the three valid values. Drop-and-recreate the constraint on
-- re-runs so editing the allow-list later is a single migration change.
alter table public.journals
  drop constraint if exists journals_length_check;

alter table public.journals
  add constraint journals_length_check
  check (length in ('brief', 'standard', 'detailed'));
