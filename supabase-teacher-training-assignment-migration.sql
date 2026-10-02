-- EduNizam verified teacher-training assignments
-- Admin assigns evidence tasks; Teacher submits; Admin approves/returns.
-- All tasks approved => verified training completion and certificate.

begin;

alter table public.teacher_training_records
  add column if not exists certificate_number text,
  add column if not exists completed_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

create unique index if not exists teacher_training_certificate_unique_idx
  on public.teacher_training_records(certificate_number)
  where certificate_number is not null;

create table if not exists public.teacher_training_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  training_record_id uuid not null references public.teacher_training_records(id) on delete cascade,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  task_title text not null,
  instructions text not null,
  due_date date,
  max_score numeric not null default 100 check (max_score > 0 and max_score <= 1000),
  status text not null default 'Assigned' check (status in ('Assigned','Submitted','Returned','Approved')),
  submission_text text,
  submission_url text,
  submitted_at timestamptz,
  score numeric,
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (score is null or (score >= 0 and score <= max_score)),
  check (char_length(btrim(task_title)) >= 3),
  check (char_length(btrim(instructions)) >= 3)
);

create index if not exists training_assignments_record_idx
  on public.teacher_training_assignments(training_record_id,created_at);
create index if not exists training_assignments_staff_idx
  on public.teacher_training_assignments(staff_profile_id,status,due_date);
create index if not exists training_assignments_reviewer_idx
  on public.teacher_training_assignments(reviewed_by)
  where reviewed_by is not null;

create index if not exists training_assignments_institution_idx
  on public.teacher_training_assignments(institution_id);
create index if not exists training_assignments_created_by_idx
  on public.teacher_training_assignments(created_by);
create index if not exists teacher_training_records_verified_by_idx
  on public.teacher_training_records(verified_by)
  where verified_by is not null;

alter table public.teacher_training_assignments enable row level security;

drop policy if exists "head and assigned teacher read training tasks" on public.teacher_training_assignments;
create policy "head and assigned teacher read training tasks"
on public.teacher_training_assignments for select to authenticated
using (
  exists(select 1 from public.institutions i
         where i.id=teacher_training_assignments.institution_id
           and i.owner_user_id=(select auth.uid()))
  or exists(select 1 from public.staff_profiles s
            where s.id=teacher_training_assignments.staff_profile_id
              and s.institution_id=teacher_training_assignments.institution_id
              and s.user_id=(select auth.uid()))
);

drop policy if exists "heads create training tasks" on public.teacher_training_assignments;
create policy "heads create training tasks"
on public.teacher_training_assignments for insert to authenticated
with check (
  created_by=(select auth.uid())
  and exists(select 1 from public.institutions i
             where i.id=teacher_training_assignments.institution_id
               and i.owner_user_id=(select auth.uid()))
  and exists(select 1 from public.teacher_training_records tr
             where tr.id=teacher_training_assignments.training_record_id
               and tr.institution_id=teacher_training_assignments.institution_id
               and tr.staff_profile_id=teacher_training_assignments.staff_profile_id)
);

drop policy if exists "heads delete training tasks" on public.teacher_training_assignments;
create policy "heads delete training tasks"
on public.teacher_training_assignments for delete to authenticated
using (
  exists(select 1 from public.institutions i
         where i.id=teacher_training_assignments.institution_id
           and i.owner_user_id=(select auth.uid()))
);

revoke all on public.teacher_training_assignments from anon;
revoke update,truncate,references,trigger on public.teacher_training_assignments from authenticated;
grant select,insert,delete on public.teacher_training_assignments to authenticated;

create or replace function public.submit_training_assignment_v1(
  p_assignment_id uuid,
  p_submission_text text default null,
  p_submission_url text default null
)
returns public.teacher_training_assignments
language plpgsql
security invoker
set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  a public.teacher_training_assignments%rowtype;
  clean_text text := nullif(btrim(coalesce(p_submission_text,'')),'');
  clean_url text := nullif(btrim(coalesce(p_submission_url,'')),'');
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if clean_text is null and clean_url is null then raise exception 'Write a response or provide an evidence link'; end if;
  if clean_url is not null and (char_length(clean_url)>2000 or clean_url !~* '^https?://') then raise exception 'Evidence link must be a valid http(s) URL'; end if;

  select * into a from public.teacher_training_assignments x where x.id=p_assignment_id for update;
  if a.id is null then raise exception 'Training assignment not found'; end if;
  if not exists(
    select 1 from public.staff_profiles s
    where s.id=a.staff_profile_id and s.institution_id=a.institution_id and s.user_id=uid
  ) then raise exception 'Assigned teacher account required'; end if;
  if a.status='Approved' then raise exception 'Approved assignment cannot be resubmitted'; end if;

  update public.teacher_training_assignments
  set submission_text=clean_text,submission_url=clean_url,submitted_at=now(),status='Submitted',
      score=null,review_note=null,reviewed_by=null,reviewed_at=null,updated_at=now()
  where id=a.id
  returning * into a;

  insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body)
  select a.institution_id,i.owner_user_id,uid,'training','Training assignment submitted',
         left(coalesce(s.full_name,'Teacher')||' · '||a.task_title,180)
  from public.institutions i
  join public.staff_profiles s on s.id=a.staff_profile_id
  where i.id=a.institution_id and i.owner_user_id<>uid;

  return a;
end;
$$;

revoke execute on function public.submit_training_assignment_v1(uuid,text,text) from public,anon;
grant execute on function public.submit_training_assignment_v1(uuid,text,text) to authenticated;

create or replace function public.review_training_assignment_v1(
  p_assignment_id uuid,
  p_decision text,
  p_score numeric default null,
  p_review_note text default null
)
returns public.teacher_training_assignments
language plpgsql
security invoker
set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  a public.teacher_training_assignments%rowtype;
  tr public.teacher_training_records%rowtype;
  teacher_uid uuid;
  decision text := initcap(lower(btrim(coalesce(p_decision,''))));
  pending_count integer := 0;
  avg_pct numeric := 0;
  cert text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if decision not in ('Approved','Returned') then raise exception 'Decision must be Approved or Returned'; end if;

  select * into a from public.teacher_training_assignments x where x.id=p_assignment_id for update;
  if a.id is null then raise exception 'Training assignment not found'; end if;
  if not exists(
    select 1 from public.institutions i
    where i.id=a.institution_id and i.owner_user_id=uid
  ) then raise exception 'Head/Admin access required'; end if;
  if a.status<>'Submitted' then raise exception 'Only submitted assignments can be reviewed'; end if;

  if decision='Approved' then
    if p_score is null then raise exception 'Score is required for approval'; end if;
    if p_score<0 or p_score>a.max_score then raise exception 'Score must be within assignment max score'; end if;
  elsif nullif(btrim(coalesce(p_review_note,'')),'') is null then
    raise exception 'Return-for-revision reason is required';
  end if;

  update public.teacher_training_assignments
  set status=decision,
      score=case when decision='Approved' then p_score else null end,
      review_note=nullif(btrim(coalesce(p_review_note,'')),''),
      reviewed_by=uid,reviewed_at=now(),updated_at=now()
  where id=a.id
  returning * into a;

  select * into tr from public.teacher_training_records r where r.id=a.training_record_id for update;
  select s.user_id into teacher_uid from public.staff_profiles s where s.id=a.staff_profile_id;

  if decision='Approved' then
    select count(*) into pending_count
    from public.teacher_training_assignments x
    where x.training_record_id=a.training_record_id and x.status<>'Approved';

    if pending_count=0 then
      select coalesce(round(avg((x.score/x.max_score)*100),2),0) into avg_pct
      from public.teacher_training_assignments x
      where x.training_record_id=a.training_record_id and x.status='Approved';

      cert:=coalesce(tr.certificate_number,'EN-TR-'||to_char(current_date,'YYYY')||'-'||upper(substr(replace(tr.id::text,'-',''),1,10)));

      update public.teacher_training_records
      set status='Completed',progress_percent=100,evaluation_score=avg_pct,
          certificate_number=cert,completed_at=coalesce(completed_at,now()),
          verified_by=uid,updated_at=now()
      where id=tr.id;
    else
      update public.teacher_training_records
      set status='In Progress',progress_percent=greatest(progress_percent,75),updated_at=now()
      where id=tr.id;
    end if;
  else
    update public.teacher_training_records
    set status='In Progress',progress_percent=least(progress_percent,90),updated_at=now()
    where id=tr.id;
  end if;

  if teacher_uid is not null then
    insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body)
    values(
      a.institution_id,teacher_uid,uid,'training',
      case when decision='Approved' then 'Training assignment approved' else 'Training assignment returned' end,
      left(a.task_title||case when a.review_note is not null then ' · '||a.review_note else '' end,180)
    );
  end if;

  return a;
end;
$$;

revoke execute on function public.review_training_assignment_v1(uuid,text,numeric,text) from public,anon;
grant execute on function public.review_training_assignment_v1(uuid,text,numeric,text) to authenticated;

commit;
