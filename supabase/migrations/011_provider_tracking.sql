-- ─────────────────────────────────────────────────────────────────────────────
-- Provider tracking + alerting for the LLM fallback (Anthropic → Gemini).
--
-- 1. ai_usage gains a `provider` column so we can attribute each call to the
--    model that actually served it.
-- 2. provider_status tracks each provider's current health. The route reads
--    it (cached in-memory per-instance with a short TTL) to know whether a
--    Claude success counts as a recovery transition.
-- 3. alerts is a write-only journal of state changes — every fallback
--    activation and recovery gets a row. There is currently no consumer
--    (no pager, no email); rows accumulate for forensic review only.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Per-call provider attribution.
alter table public.ai_usage
  add column if not exists provider text not null default 'anthropic';

-- 2. Provider health table. One row per provider; primary key is `provider`
--    so upserts on transition are idempotent.
create table if not exists public.provider_status (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  status text not null check (status in ('healthy', 'degraded')),
  last_failure timestamptz,
  last_recovery timestamptz,
  updated_at timestamptz not null default now()
);

-- Seed both providers as healthy. on conflict do nothing so re-running this
-- migration in a non-empty DB is safe.
insert into public.provider_status (provider, status)
values ('anthropic', 'healthy'), ('google', 'healthy')
on conflict (provider) do nothing;

-- 3. State-transition log. Append-only.
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  event_type text not null check (event_type in ('fallback_activated', 'provider_recovered')),
  original_provider text not null,
  fallback_provider text,
  error_message text
);

create index if not exists alerts_timestamp_idx on public.alerts (timestamp desc);

-- Both tables are service-role-only — the route handler writes via the
-- supabaseAdmin client, and there is no user-facing read path. No RLS
-- policies are added; the absence of any policy on a table with RLS
-- enabled would block all access, so we leave RLS off (matching ai_usage).
