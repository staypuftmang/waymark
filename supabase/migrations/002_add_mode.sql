-- Add a mode column so we can remember which flow (Quick Create vs Full
-- Builder) a journal was created in, and route the user back to the correct
-- builder when they reopen it.
alter table public.journals
  add column if not exists mode text not null default 'quick'
  check (mode in ('quick', 'full'));
