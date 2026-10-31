-- EduNizam hardening: block anonymous execution of SECURITY DEFINER functions
-- Keep authenticated app users and service_role able to call RPCs.
begin;

do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public'
      and p.prosecdef = true
  loop
    execute format('revoke all on function %I.%I(%s) from public',
      r.schema_name, r.function_name, r.identity_args);
    execute format('revoke all on function %I.%I(%s) from anon',
      r.schema_name, r.function_name, r.identity_args);
    execute format('grant execute on function %I.%I(%s) to authenticated',
      r.schema_name, r.function_name, r.identity_args);
    execute format('grant execute on function %I.%I(%s) to service_role',
      r.schema_name, r.function_name, r.identity_args);
  end loop;
end
$$;

commit;
