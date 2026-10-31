-- Preserve public read-only RPC signatures while moving elevated reads out
-- of the exposed API schema. Applied to production on 2026-10-06 after a
-- rollback-only Head/Teacher/Student/Parent regression test.

create or replace function private.current_account_role_v1(p_user_id uuid)
returns text
language sql stable security definer set search_path=''
as $$
  select case when p_user_id is null then null else coalesce(
    (select 'head_of_institute'::text
     from public.institutions i
     where i.owner_user_id=p_user_id
     limit 1),
    (
      select m.role
      from public.institution_members m
      where m.user_id=p_user_id
        and m.role in ('teacher','parent','student')
      order by case m.role when 'teacher' then 1 when 'parent' then 2 else 3 end
      limit 1
    )
  ) end;
$$;

create or replace function private.is_institution_staff_v1(
  p_institution_id uuid,p_user_id uuid
)
returns boolean
language sql stable security definer set search_path=''
as $$
  select p_user_id is not null and (
    exists(
      select 1 from public.institutions i
      where i.id=p_institution_id and i.owner_user_id=p_user_id
    )
    or exists(
      select 1 from public.institution_members m
      where m.institution_id=p_institution_id
        and m.user_id=p_user_id
        and m.role='teacher'
    )
  );
$$;

create or replace function private.is_institution_user_v1(
  p_institution_id uuid,p_user_id uuid
)
returns boolean
language sql stable security definer set search_path=''
as $$
  select p_user_id is not null and (
    exists(
      select 1 from public.institutions i
      where i.id=p_institution_id and i.owner_user_id=p_user_id
    )
    or exists(
      select 1 from public.institution_members m
      where m.institution_id=p_institution_id and m.user_id=p_user_id
    )
  );
$$;

create or replace function private.is_platform_admin_v1(p_user_id uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select p_user_id is not null
    and exists(select 1 from public.platform_admins p where p.user_id=p_user_id);
$$;

revoke all on function private.current_account_role_v1(uuid) from public,anon;
revoke all on function private.is_institution_staff_v1(uuid,uuid) from public,anon;
revoke all on function private.is_institution_user_v1(uuid,uuid) from public,anon;
revoke all on function private.is_platform_admin_v1(uuid) from public,anon;
grant execute on function private.current_account_role_v1(uuid) to authenticated;
grant execute on function private.is_institution_staff_v1(uuid,uuid) to authenticated;
grant execute on function private.is_institution_user_v1(uuid,uuid) to authenticated;
grant execute on function private.is_platform_admin_v1(uuid) to authenticated;

create or replace function public.current_account_role()
returns text
language sql stable security invoker set search_path=''
as $$
  select private.current_account_role_v1((select auth.uid()));
$$;

create or replace function public.is_institution_staff(p_institution_id uuid)
returns boolean
language sql stable security invoker set search_path=''
as $$
  select private.is_institution_staff_v1(p_institution_id,(select auth.uid()));
$$;

create or replace function public.is_institution_user(target uuid)
returns boolean
language sql stable security invoker set search_path=''
as $$
  select private.is_institution_user_v1(target,(select auth.uid()));
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql stable security invoker set search_path=''
as $$
  select private.is_platform_admin_v1((select auth.uid()));
$$;

alter function public.edunizam_ai_health_check() security invoker;
alter function public.edunizam_health_check() security invoker;
