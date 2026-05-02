-- ─────────────────────────────────────────────────────────────────────────────
-- Public-journal view analytics.
--
-- One row per visit to /j/[slug]. Inserted server-side from the public
-- journal page using the service-role client; reads are RLS-gated to the
-- journal owner so the dashboard can show counts and stats per journal
-- without exposing visitor data to the wider world.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.journal_views (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  referrer text,
  country text,
  city text,
  user_agent text
);

-- Counts and time-window queries are always scoped to a single journal.
create index if not exists journal_views_journal_id_viewed_at_idx
  on public.journal_views (journal_id, viewed_at desc);

-- ── RLS: read-only access for the journal owner ────────────────────────────
alter table public.journal_views enable row level security;

-- Owners can read view rows for journals they own. Inserts go through
-- service-role (no policy needed — service role bypasses RLS).
create policy "Owners can read views for their journals"
  on public.journal_views for select
  to authenticated
  using (
    exists (
      select 1 from public.journals j
      where j.id = journal_views.journal_id
        and j.user_id = auth.uid()
    )
  );

-- ── RPC: aggregated view counts for the dashboard ──────────────────────────
-- Returns one row per public journal owned by the caller, with total view
-- count. Lets the dashboard avoid pulling raw view rows for every journal.
create or replace function public.get_my_journal_view_counts()
returns table (journal_id uuid, view_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select jv.journal_id, count(*)::bigint as view_count
  from public.journal_views jv
  inner join public.journals j on j.id = jv.journal_id
  where j.user_id = auth.uid()
    and j.is_public = true
  group by jv.journal_id;
$$;

grant execute on function public.get_my_journal_view_counts() to authenticated;
