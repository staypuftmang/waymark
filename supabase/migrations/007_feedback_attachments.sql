-- ─────────────────────────────────────────────────────────────────────────────
-- Feedback screenshot attachments.
--
-- Adds a text[] column to feedback for storing public URLs to uploaded
-- screenshots, and provisions a dedicated public storage bucket with RLS
-- that anyone (anon or signed-in) can write to and the world can read
-- from. Reads of the feedback table itself remain service-role-only.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.feedback
  add column if not exists attachments text[];

-- Create the bucket if it doesn't exist. Public so the URLs we store are
-- directly reachable; the privacy posture is "by design, attached
-- screenshots are visible to anyone with the URL" — same as the journal
-- /j/[slug] sharing model.
insert into storage.buckets (id, name, public)
values ('feedback-attachments', 'feedback-attachments', true)
on conflict (id) do nothing;

-- Storage policies: writes are open (any role), reads are public.
-- Updates and deletes have no policy → service-role-only.

create policy "feedback-attachments: anon insert"
on storage.objects for insert
to anon
with check (bucket_id = 'feedback-attachments');

create policy "feedback-attachments: auth insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'feedback-attachments');

create policy "feedback-attachments: public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'feedback-attachments');
