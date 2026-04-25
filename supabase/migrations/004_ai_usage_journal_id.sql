-- Per-journal rate limiting needs to attribute each AI usage row to a
-- specific journal so we can enforce the 30-rewrite-per-journal cap and the
-- 5-minute cooldown. journal_id is nullable because the very first call
-- on a brand-new journal can fire before the first auto-save creates the
-- journals row.
alter table public.ai_usage
  add column if not exists journal_id uuid
  references public.journals(id) on delete cascade;

create index if not exists ai_usage_journal_action_idx
  on public.ai_usage(journal_id, action_type);
