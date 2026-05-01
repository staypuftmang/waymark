-- ─────────────────────────────────────────────────────────────────────────────
-- Track which voice / length the AI used to write the current journal content.
--
-- On every successful AI generation or rewrite, the page snapshots the active
-- ws and len into these columns. Update Journal then compares the *current*
-- settings to the snapshot and prompts the user if they differ ("Regenerate
-- with new settings, or keep current text?"). Without this, switching Voice
-- or Length on a saved journal silently saves but the AI text stays put.
--
-- Both columns default to NULL so the comparison treats fresh journals (no AI
-- run yet) and journals from before this migration as "no snapshot, no prompt".
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.journals
  add column if not exists generation_word_style text;

alter table public.journals
  add column if not exists generation_length text;
