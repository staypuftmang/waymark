-- Per-user rate limiting expects an action_type column with values like
-- 'generate', 'rewrite', 'rewrite_all'. The original schema named it `action`.
-- Rename it for consistency with the rate-limit code that follows.
alter table public.ai_usage
  rename column action to action_type;
