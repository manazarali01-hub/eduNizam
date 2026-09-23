-- EduNizam: require verified school membership for non-admin roles
-- Prevents an authenticated but unlinked account from being treated as a Student.

create or replace function public.current_account_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select 'head_of_institute'::text
      from public.institutions i
      where i.owner_user_id = auth.uid()
      limit 1
    ),
    (
      select p.account_role
      from public.user_profiles p
      where p.user_id = auth.uid()
        and p.account_role in ('teacher','parent','student')
        and p.institution_id is not null
        and exists (
          select 1
          from public.institution_members m
          where m.institution_id = p.institution_id
            and m.user_id = p.user_id
            and m.role = p.account_role
        )
      limit 1
    )
  );
$$;

revoke all on function public.current_account_role() from public;
revoke all on function public.current_account_role() from anon;
grant execute on function public.current_account_role() to authenticated;
