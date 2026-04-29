-- ─────────────────────────────────────────────────────────────────────────────
-- Feedback table — captures in-app feedback messages from anyone (anon or
-- signed-in). Reads are admin-only via the service-role key; the app never
-- reads this table from the client.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  email       text,
  category    text not null check (category in ('bug', 'feature_request', 'question', 'other')),
  message     text not null check (length(message) between 1 and 4000),
  page_url    text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index feedback_created_at_idx on public.feedback(created_at desc);

alter table public.feedback enable row level security;

-- Anyone may insert (anon + signed-in). The check forces consistency:
-- if a user_id is supplied, it must match the caller; if not, no email
-- claim is enforced on the row.
create policy "feedback: insert anon"
on public.feedback for insert
to anon
with check (user_id is null);

create policy "feedback: insert authenticated"
on public.feedback for insert
to authenticated
with check (user_id is null or user_id = auth.uid());

-- No select / update / delete policies — table is service-role-only for reads.
