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


-- Atomically reserve a daily AI request before calling the provider. The
-- per-user transaction lock prevents parallel requests from bypassing quota.
create or replace function public.edunizam_ai_reserve_usage(
  p_user_id uuid,
  p_institution_id uuid,
  p_model text,
  p_request_chars integer,
  p_daily_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $
declare
  v_used integer;
  v_usage_id bigint;
  v_limit integer := greatest(1, least(coalesce(p_daily_limit, 25), 10000));
  v_day_start timestamptz := date_trunc('day', timezone('utc', now())) at time zone 'utc';
begin
  if p_user_id is null then
    raise exception 'A user ID is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*)::integer into v_used
  from public.ai_usage_logs
  where user_id = p_user_id
    and created_at >= v_day_start;

  if v_used >= v_limit then
    return jsonb_build_object('allowed', false, 'remaining', 0);
  end if;

  insert into public.ai_usage_logs(institution_id, user_id, model, request_chars)
  values (p_institution_id, p_user_id, coalesce(nullif(p_model, ''), 'unknown'), greatest(0, coalesce(p_request_chars, 0)))
  returning id into v_usage_id;

  return jsonb_build_object(
    'allowed', true,
    'usage_id', v_usage_id,
    'remaining', greatest(0, v_limit - v_used - 1)
  );
end;
$;

-- Only the Edge Function's service-role client may reserve quota.
revoke all on function public.edunizam_ai_reserve_usage(uuid, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.edunizam_ai_reserve_usage(uuid, uuid, text, integer, integer) to service_role;

commit;
