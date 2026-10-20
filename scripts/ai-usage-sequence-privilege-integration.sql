\set ON_ERROR_STOP on
begin;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if has_sequence_privilege(role_name, 'public.ai_usage_logs_id_seq', 'USAGE')
      or has_sequence_privilege(role_name, 'public.ai_usage_logs_id_seq', 'SELECT')
      or has_sequence_privilege(role_name, 'public.ai_usage_logs_id_seq', 'UPDATE') then
      raise exception '% still has direct privileges on the AI usage sequence', role_name;
    end if;
  end loop;

  if not has_sequence_privilege('postgres', 'public.ai_usage_logs_id_seq', 'USAGE')
    or not has_sequence_privilege('postgres', 'public.ai_usage_logs_id_seq', 'UPDATE') then
    raise exception 'Sequence owner lost required identity-sequence privileges';
  end if;
end
$$;

rollback;
select 'AI usage sequence privilege integration checks passed.' as result;
