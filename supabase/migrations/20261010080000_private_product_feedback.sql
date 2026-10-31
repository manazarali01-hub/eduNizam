-- EduNizam private public-feedback intake (also applied to the live Supabase project).
create table if not exists public.platform_feedback (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('bug','missing_data','suggestion','appreciation')),
  rating smallint check (rating between 1 and 5),
  message text not null check (char_length(btrim(message)) between 20 and 1500),
  status text not null default 'new' check (status in ('new','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);
alter table public.platform_feedback enable row level security;
revoke all privileges on table public.platform_feedback from public, anon, authenticated;
grant insert (category, rating, message) on public.platform_feedback to anon, authenticated;
drop policy if exists "Public visitors may submit feedback" on public.platform_feedback;
create policy "Public visitors may submit feedback"
  on public.platform_feedback for insert
  to anon, authenticated
  with check (status = 'new'
              and category in ('bug','missing_data','suggestion','appreciation')
              and char_length(btrim(message)) between 20 and 1500);
comment on table public.platform_feedback is
  'Private product feedback; visitors may submit but cannot read, edit or delete feedback.';
