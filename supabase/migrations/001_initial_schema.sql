-- ─────────────────────────────────────────────────────────────────────────────
-- Waymark — Phase 3 initial schema
-- Tables: profiles, journals, journal_photos, ai_usage
-- All tables enable Row Level Security; policies live alongside each table.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: auto-update an `updated_at` column on every row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles: select own"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "profiles: update own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- journals
-- ─────────────────────────────────────────────────────────────────────────────
create table public.journals (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  title               text,
  trip_brief          text,
  start_date          date,
  end_date            date,
  visual_style        text not null default 'editorial',
  word_style          text not null default 'poetic',
  layout              text not null default 'classic',
  cover_photo_id      uuid,
  cover_title         text,
  cover_subtitle      text,
  cover_title_edited  boolean not null default false,
  status              text not null default 'draft' check (status in ('draft', 'published')),
  share_slug          text unique,
  is_public           boolean not null default false,
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index journals_user_id_idx on public.journals(user_id);

create trigger journals_set_updated_at
before update on public.journals
for each row execute function public.set_updated_at();

alter table public.journals enable row level security;

create policy "journals: select own"
on public.journals for select
to authenticated
using (user_id = auth.uid());

create policy "journals: insert own"
on public.journals for insert
to authenticated
with check (user_id = auth.uid());

create policy "journals: update own"
on public.journals for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "journals: delete own"
on public.journals for delete
to authenticated
using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- journal_photos
-- ─────────────────────────────────────────────────────────────────────────────
create table public.journal_photos (
  id            uuid primary key default gen_random_uuid(),
  journal_id    uuid not null references public.journals(id) on delete cascade,
  photo_order   integer not null default 0,
  src           text not null,
  caption       text,
  notes         text,
  paragraph     text,
  ai_caption    text,
  ai_notes      text,
  ai_paragraph  text,
  is_cover      boolean not null default false,
  created_at    timestamptz not null default now()
);

create index journal_photos_journal_id_idx on public.journal_photos(journal_id);

alter table public.journal_photos enable row level security;

create policy "journal_photos: select via owner journal"
on public.journal_photos for select
to authenticated
using (
  exists (
    select 1 from public.journals j
    where j.id = journal_photos.journal_id and j.user_id = auth.uid()
  )
);

create policy "journal_photos: insert via owner journal"
on public.journal_photos for insert
to authenticated
with check (
  exists (
    select 1 from public.journals j
    where j.id = journal_photos.journal_id and j.user_id = auth.uid()
  )
);

create policy "journal_photos: update via owner journal"
on public.journal_photos for update
to authenticated
using (
  exists (
    select 1 from public.journals j
    where j.id = journal_photos.journal_id and j.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.journals j
    where j.id = journal_photos.journal_id and j.user_id = auth.uid()
  )
);

create policy "journal_photos: delete via owner journal"
on public.journal_photos for delete
to authenticated
using (
  exists (
    select 1 from public.journals j
    where j.id = journal_photos.journal_id and j.user_id = auth.uid()
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ai_usage
-- ─────────────────────────────────────────────────────────────────────────────
create table public.ai_usage (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  action      text not null default 'generation',
  created_at  timestamptz not null default now()
);

create index ai_usage_user_id_created_at_idx on public.ai_usage(user_id, created_at desc);

alter table public.ai_usage enable row level security;
-- No policies — only the service-role key may read or write.
