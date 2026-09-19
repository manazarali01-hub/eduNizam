-- EduNizam AI usage controls
-- Apply on existing deployments before enabling the ai-assistant Edge Function.

begin;

create table if not exists public.ai_usage_logs (
  id bigint generated always as identity primary key,
  institution_id uuid references public.institutions(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  request_chars integer not null default 0 check (request_chars >= 0),
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_logs_user_created_idx
on public.ai_usage_logs(user_id,created_at desc);

alter table public.ai_usage_logs enable row level security;

drop policy if exists "users read own ai usage" on public.ai_usage_logs;
create policy "users read own ai usage" on public.ai_usage_logs
for select to authenticated
using (user_id=auth.uid());

create or replace function public.edunizam_ai_health_check()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'authenticated', auth.uid() is not null,
    'usage_table', to_regclass('public.ai_usage_logs') is not null
  );
$$;

grant execute on function public.edunizam_ai_health_check() to authenticated;

commit;
