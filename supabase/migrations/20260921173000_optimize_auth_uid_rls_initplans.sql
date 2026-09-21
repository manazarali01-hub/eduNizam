-- EduNizam RLS performance hardening.
-- Preserve policy logic while replacing per-row auth.uid() evaluation with
-- a scalar subquery, as recommended by Supabase for RLS init-plan caching.

do $$
declare
  p record;
  new_qual text;
  new_check text;
  role_list text;
  create_sql text;
begin
  for p in
    select *
    from pg_policies
    where schemaname='public'
      and (
        coalesce(qual,'') like '%auth.uid()%'
        or coalesce(with_check,'') like '%auth.uid()%'
      )
      and coalesce(qual,'') !~* 'select\s+auth\.uid\(\)'
      and coalesce(with_check,'') !~* 'select\s+auth\.uid\(\)'
  loop
    new_qual := case
      when p.qual is null then null
      else replace(p.qual,'auth.uid()','(select auth.uid())')
    end;
    new_check := case
      when p.with_check is null then null
      else replace(p.with_check,'auth.uid()','(select auth.uid())')
    end;

    select string_agg(quote_ident(x), ', ')
      into role_list
    from unnest(p.roles) as x;

    execute format(
      'drop policy %I on %I.%I',
      p.policyname,
      p.schemaname,
      p.tablename
    );

    create_sql := format(
      'create policy %I on %I.%I as %s for %s to %s',
      p.policyname,
      p.schemaname,
      p.tablename,
      p.permissive,
      p.cmd,
      role_list
    );

    if new_qual is not null then
      create_sql := create_sql || ' using (' || new_qual || ')';
    end if;

    if new_check is not null then
      create_sql := create_sql || ' with check (' || new_check || ')';
    end if;

    execute create_sql;
  end loop;
end $$;
