-- EduNizam performance hardening.
-- Add a covering btree index for each public foreign-key column set that does
-- not already have one. Idempotent and safe to rerun.

do $$
declare
  r record;
  idx_name text;
begin
  for r in
    with fk as (
      select
        con.oid as constraint_oid,
        con.conrelid,
        n.nspname as schema_name,
        c.relname as table_name,
        con.conkey as attnums
      from pg_constraint con
      join pg_class c on c.oid=con.conrelid
      join pg_namespace n on n.oid=c.relnamespace
      where con.contype='f'
        and n.nspname='public'
    ),
    cols as (
      select
        fk.*,
        array_agg(a.attname order by u.ord) as columns
      from fk
      join lateral unnest(fk.attnums) with ordinality as u(attnum,ord) on true
      join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=u.attnum
      group by fk.constraint_oid,fk.conrelid,fk.schema_name,fk.table_name,fk.attnums
    )
    select schema_name,table_name,columns
    from cols x
    where not exists (
      select 1
      from pg_index i
      where i.indrelid=x.conrelid
        and i.indisvalid
        and (i.indkey::smallint[])[1:cardinality(x.attnums)] = x.attnums
    )
  loop
    idx_name:=left('fkidx_'||r.table_name||'_'||array_to_string(r.columns,'_'),63);
    execute format(
      'create index if not exists %I on %I.%I (%s)',
      idx_name,
      r.schema_name,
      r.table_name,
      (select string_agg(format('%I',x),', ') from unnest(r.columns) x)
    );
  end loop;
end $$;
