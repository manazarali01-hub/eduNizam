-- EduNizam Visitor & Student Gate Pass upgrade migration
-- =========================================================
-- EduNizam Visitor & Student Gate Pass
-- =========================================================
begin;

create table if not exists public.school_visitors (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  visitor_name text not null,
  phone text,
  purpose text not null,
  person_to_meet text,
  vehicle_no text,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  notes text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists school_visitors_institution_time_idx on public.school_visitors(institution_id,checked_in_at desc);
alter table public.school_visitors enable row level security;

drop policy if exists "heads manage school visitors" on public.school_visitors;
create policy "heads manage school visitors" on public.school_visitors
for all to authenticated
using (exists(select 1 from public.institutions i where i.id=school_visitors.institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=school_visitors.institution_id and i.owner_user_id=auth.uid()));

create table if not exists public.student_gate_passes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.core_students(id) on delete cascade,
  exit_date date not null,
  exit_time time not null,
  pickup_name text not null,
  pickup_phone text,
  pickup_relation text,
  reason text not null,
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected','Exited','Cancelled')),
  admin_note text,
  requested_by uuid not null references auth.users(id) on delete cascade,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  exited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists student_gate_passes_student_date_idx on public.student_gate_passes(student_id,exit_date desc);
alter table public.student_gate_passes enable row level security;

drop policy if exists "authorized users read gate passes" on public.student_gate_passes;
create policy "authorized users read gate passes" on public.student_gate_passes
for select to authenticated
using (
  exists(select 1 from public.institutions i where i.id=student_gate_passes.institution_id and i.owner_user_id=auth.uid())
  or exists(
    select 1 from public.core_students s
    where s.id=student_gate_passes.student_id
      and (
        s.auth_user_id=auth.uid()
        or exists(
          select 1 from public.parent_student_links l
          where l.institution_id=s.institution_id
            and l.parent_user_id=auth.uid()
            and l.student_user_id=s.auth_user_id
            and l.status='approved'
        )
      )
  )
);

create or replace function public.create_student_gate_pass(
  p_student_id uuid,
  p_exit_date date,
  p_exit_time time,
  p_pickup_name text,
  p_pickup_phone text,
  p_pickup_relation text,
  p_reason text
)
returns public.student_gate_passes
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.core_students%rowtype;
  r text;
  result_row public.student_gate_passes%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into s from public.core_students where id=p_student_id;
  if s.id is null then raise exception 'Student not found'; end if;
  if p_exit_date is null or p_exit_date<current_date then raise exception 'Exit date must be today or future'; end if;
  if p_exit_time is null then raise exception 'Exit time required'; end if;
  if nullif(trim(p_pickup_name),'') is null or nullif(trim(p_reason),'') is null then raise exception 'Pickup person and reason required'; end if;

  r:=public.current_account_role();
  if r='head_of_institute' then
    if not exists(select 1 from public.institutions i where i.id=s.institution_id and i.owner_user_id=auth.uid()) then raise exception 'Head access required'; end if;
  elsif r='parent' then
    if not exists(
      select 1 from public.parent_student_links l
      where l.institution_id=s.institution_id
        and l.parent_user_id=auth.uid()
        and l.student_user_id=s.auth_user_id
        and l.status='approved'
    ) then raise exception 'Parent is not linked to this student'; end if;
  else
    raise exception 'Only Parent or Head can request a gate pass';
  end if;

  insert into public.student_gate_passes(
    institution_id,student_id,exit_date,exit_time,pickup_name,pickup_phone,pickup_relation,reason,requested_by
  ) values(
    s.institution_id,s.id,p_exit_date,p_exit_time,trim(p_pickup_name),nullif(trim(p_pickup_phone),''),nullif(trim(p_pickup_relation),''),trim(p_reason),auth.uid()
  )
  returning * into result_row;

  if r='parent' then
    insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body)
    select i.id,i.owner_user_id,auth.uid(),'gate_pass','Gate pass request',left(s.name||' · '||trim(p_reason),180)
    from public.institutions i where i.id=s.institution_id;
  end if;

  return result_row;
end;
$$;
grant execute on function public.create_student_gate_pass(uuid,date,time,text,text,text,text) to authenticated;

create or replace function public.update_student_gate_pass_status(
  p_gate_pass_id uuid,
  p_status text,
  p_admin_note text
)
returns public.student_gate_passes
language plpgsql
security definer
set search_path=public
as $$
declare
  g public.student_gate_passes%rowtype;
  s public.core_students%rowtype;
  result_row public.student_gate_passes%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status not in ('Approved','Rejected','Exited','Cancelled') then raise exception 'Invalid status'; end if;

  select * into g from public.student_gate_passes where id=p_gate_pass_id for update;
  if g.id is null then raise exception 'Gate pass not found'; end if;
  if not exists(select 1 from public.institutions i where i.id=g.institution_id and i.owner_user_id=auth.uid()) then raise exception 'Head access required'; end if;

  if p_status='Exited' and g.status<>'Approved' then raise exception 'Only approved gate pass can be marked Exited'; end if;

  update public.student_gate_passes
  set status=p_status,
      admin_note=coalesce(nullif(trim(p_admin_note),''),admin_note),
      approved_by=case when p_status='Approved' then auth.uid() else approved_by end,
      approved_at=case when p_status='Approved' then now() else approved_at end,
      exited_at=case when p_status='Exited' then now() else exited_at end,
      updated_at=now()
  where id=g.id
  returning * into result_row;

  select * into s from public.core_students where id=g.student_id;

  if s.auth_user_id is not null then
    insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body)
    values(g.institution_id,s.auth_user_id,auth.uid(),'gate_pass','Gate pass '||lower(p_status),left(result_row.reason,180));
  end if;

  insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body)
  select g.institution_id,l.parent_user_id,auth.uid(),'gate_pass','Gate pass '||lower(p_status),left(result_row.reason,180)
  from public.parent_student_links l
  where l.institution_id=g.institution_id
    and l.student_user_id=s.auth_user_id
    and l.status='approved';

  return result_row;
end;
$$;
grant execute on function public.update_student_gate_pass_status(uuid,text,text) to authenticated;

commit;


