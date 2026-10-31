-- EduNizam role invite + easy parent linking migration
-- Apply after supabase-full-schema.sql.

begin;

create table if not exists public.institution_invites (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  code text not null unique,
  target_role text not null check (target_role in ('teacher','student','parent')),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz,
  max_uses integer not null default 1 check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.institution_invites enable row level security;

drop policy if exists "staff manage institution invites" on public.institution_invites;
create policy "staff manage institution invites" on public.institution_invites
for all to authenticated
using (public.is_institution_staff(institution_id))
with check (public.is_institution_staff(institution_id));

create or replace function public.claim_institution_invite(p_code text)
returns table(institution_id uuid, institution_name text, granted_role text)
language plpgsql
security definer
set search_path=public
as $$
declare
  inv public.institution_invites%rowtype;
  inst_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into inv
  from public.institution_invites
  where upper(code)=upper(trim(p_code))
    and active=true
    and (expires_at is null or expires_at > now())
    and use_count < max_uses
  for update;

  if inv.id is null then raise exception 'Invite code is invalid, expired, or already used'; end if;

  select name into inst_name from public.institutions where id=inv.institution_id;

  if inv.target_role='teacher' then
    insert into public.institution_members(institution_id,user_id,role)
    values(inv.institution_id,auth.uid(),'teacher')
    on conflict (institution_id,user_id) do update set role='teacher';
  else
    insert into public.user_profiles(user_id,account_role,institution_id)
    values(auth.uid(),inv.target_role,inv.institution_id)
    on conflict (user_id) do update
      set account_role=excluded.account_role,
          institution_id=excluded.institution_id,
          updated_at=now();
  end if;

  update public.institution_invites
  set use_count=use_count+1,
      active=case when use_count+1 >= max_uses then false else active end
  where id=inv.id;

  return query select inv.institution_id,inst_name,inv.target_role;
end;
$$;

create or replace function public.request_parent_link_by_student_code(p_student_code text)
returns public.parent_student_links
language plpgsql
security definer
set search_path=public
as $$
declare
  profile_role text;
  student_row public.core_students%rowtype;
  result_row public.parent_student_links%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select account_role into profile_role from public.user_profiles where user_id=auth.uid();
  if profile_role <> 'parent' then raise exception 'Parent account required'; end if;

  select * into student_row
  from public.core_students
  where upper(student_code)=upper(trim(p_student_code))
    and auth_user_id is not null
  limit 1;

  if student_row.id is null then raise exception 'Student code not found or student account is not linked yet'; end if;

  insert into public.parent_student_links(parent_user_id,student_user_id,institution_id,status)
  values(auth.uid(),student_row.auth_user_id,student_row.institution_id,'pending')
  on conflict (parent_user_id,student_user_id)
  do update set institution_id=excluded.institution_id,status='pending'
  returning * into result_row;

  return result_row;
end;
$$;

grant execute on function public.claim_institution_invite(text) to authenticated;
grant execute on function public.request_parent_link_by_student_code(text) to authenticated;

commit;
