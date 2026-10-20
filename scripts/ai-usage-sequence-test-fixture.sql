\\set ON_ERROR_STOP on
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

drop sequence if exists public.ai_usage_logs_id_seq;
create sequence public.ai_usage_logs_id_seq;
grant usage, select, update on sequence public.ai_usage_logs_id_seq to anon, authenticated;
