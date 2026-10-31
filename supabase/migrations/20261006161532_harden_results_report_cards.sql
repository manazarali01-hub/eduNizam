create unique index if not exists result_records_semantic_unique_idx
on public.result_records (
  institution_id,
  student_id,
  lower(btrim(subject)),
  coalesce(nullif(btrim(assessment_type),''),'Result'),
  coalesce(assessment_date,date '0001-01-01')
);

create unique index if not exists exam_schedule_semantic_unique_idx
on public.exam_schedule_entries (
  institution_id,
  lower(btrim(class_name)),
  lower(btrim(coalesce(section_name,''))),
  lower(btrim(exam_name)),
  lower(btrim(subject)),
  exam_date
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.result_records'::regclass
      and conname='result_records_assessment_type_nonempty_check'
  ) then
    alter table public.result_records
      add constraint result_records_assessment_type_nonempty_check
      check (assessment_type is null or nullif(btrim(assessment_type),'') is not null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.exam_schedule_entries'::regclass
      and conname='exam_schedule_text_nonempty_check'
  ) then
    alter table public.exam_schedule_entries
      add constraint exam_schedule_text_nonempty_check
      check (
        nullif(btrim(class_name),'') is not null
        and nullif(btrim(exam_name),'') is not null
        and nullif(btrim(subject),'') is not null
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.exam_schedule_entries'::regclass
      and conname='exam_schedule_time_order_check'
  ) then
    alter table public.exam_schedule_entries
      add constraint exam_schedule_time_order_check
      check (start_time is null or end_time is null or end_time > start_time);
  end if;
end
$$;

create or replace function private.can_manage_exam_schedule_v1(
  p_institution_id uuid,
  p_class_name text,
  p_section_name text,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select p_user_id is not null and (
    exists(
      select 1
      from public.institutions i
      where i.id=p_institution_id
        and i.owner_user_id=p_user_id
    )
    or (
      exists(
        select 1
        from public.institution_members m
        where m.institution_id=p_institution_id
          and m.user_id=p_user_id
          and m.role='teacher'
      )
      and (
        exists(
          select 1
          from public.class_sections cs
          where cs.institution_id=p_institution_id
            and cs.class_teacher_user_id=p_user_id
            and coalesce(cs.active,true)=true
            and lower(btrim(cs.class_name))=lower(btrim(coalesce(p_class_name,'')))
            and lower(btrim(coalesce(cs.section_name,'')))=lower(btrim(coalesce(p_section_name,'')))
        )
        or exists(
          select 1
          from public.teacher_student_links l
          join public.core_students s
            on s.institution_id=l.institution_id
           and s.auth_user_id=l.student_user_id
          where l.institution_id=p_institution_id
            and l.teacher_user_id=p_user_id
            and lower(btrim(coalesce(s.class_name,'')))=lower(btrim(coalesce(p_class_name,'')))
            and lower(btrim(coalesce(s.section_name,'')))=lower(btrim(coalesce(p_section_name,'')))
        )
      )
    )
  );
$function$;

revoke all on function private.can_manage_exam_schedule_v1(uuid,text,text,uuid) from public, anon;
grant execute on function private.can_manage_exam_schedule_v1(uuid,text,text,uuid) to authenticated;

drop policy if exists "staff manage exam schedule" on public.exam_schedule_entries;
create policy "assigned staff manage exam schedule"
on public.exam_schedule_entries
for all
to authenticated
using (
  (select private.can_manage_exam_schedule_v1(
    exam_schedule_entries.institution_id,
    exam_schedule_entries.class_name,
    exam_schedule_entries.section_name,
    (select auth.uid())
  ))
  and (
    exists(
      select 1 from public.institutions i
      where i.id=exam_schedule_entries.institution_id
        and i.owner_user_id=(select auth.uid())
    )
    or exam_schedule_entries.creator_user_id=(select auth.uid())
  )
)
with check (
  (select private.can_manage_exam_schedule_v1(
    exam_schedule_entries.institution_id,
    exam_schedule_entries.class_name,
    exam_schedule_entries.section_name,
    (select auth.uid())
  ))
  and exam_schedule_entries.creator_user_id=(select auth.uid())
);

create or replace function private.publish_report_card_v2_impl(
  p_student_id uuid,
  p_report_type text default null,
  p_title text default null
)
returns public.report_card_publications
language plpgsql
security definer
set search_path=''
as $function$
declare
  uid uuid := (select auth.uid());
  st public.core_students%rowtype;
  out_row public.report_card_publications%rowtype;
  normalized_type text := coalesce(nullif(btrim(coalesce(p_report_type,'')),''),'Combined Results');
  normalized_title text;
  subjects_json jsonb := '[]'::jsonb;
  obtained numeric := 0;
  total_marks numeric := 0;
  overall numeric := 0;
  result_count integer := 0;
  v_version integer := 1;
  present_count integer := 0;
  absent_count integer := 0;
  late_count integer := 0;
  leave_count integer := 0;
  attendance_count integer := 0;
  attendance_pct numeric := null;
  v_grade text := 'F';
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into st
  from public.core_students s
  where s.id=p_student_id;

  if st.id is null then raise exception 'Student not found'; end if;

  if not (select private.can_manage_core_student_v1(st.id,uid)) then
    raise exception 'Teacher / Admin access required for this student';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(st.id::text||'|'||normalized_type,0)
  );

  with filtered as (
    select r.*
    from public.result_records r
    where r.student_id=st.id
      and (
        normalized_type='Combined Results'
        or coalesce(nullif(btrim(r.assessment_type),''),'Result')=normalized_type
      )
  ),
  grouped as (
    select
      subject,
      sum(marks)::numeric as marks,
      sum(total)::numeric as total,
      count(*)::integer as assessments
    from filtered
    group by subject
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'subject',subject,
          'marks',marks,
          'total',total,
          'percentage',case when total>0 then round((marks/total)*100,2) else 0 end,
          'grade',case
            when total<=0 then 'F'
            when (marks/total)*100>=80 then 'A+'
            when (marks/total)*100>=70 then 'A'
            when (marks/total)*100>=60 then 'B'
            when (marks/total)*100>=50 then 'C'
            when (marks/total)*100>=40 then 'D'
            else 'F'
          end,
          'status',case when total>0 and (marks/total)*100>=40 then 'Pass' else 'Needs Support' end,
          'assessments',assessments
        )
        order by subject
      ),
      '[]'::jsonb
    ),
    coalesce(sum(marks),0),
    coalesce(sum(total),0),
    coalesce(sum(assessments),0)
  into subjects_json,obtained,total_marks,result_count
  from grouped;

  if result_count=0 or total_marks<=0 then
    raise exception 'No result records are available for this report type';
  end if;

  overall:=round((obtained/total_marks)*100,2);
  v_grade:=case
    when overall>=80 then 'A+'
    when overall>=70 then 'A'
    when overall>=60 then 'B'
    when overall>=50 then 'C'
    when overall>=40 then 'D'
    else 'F'
  end;

  select
    count(*) filter(where status='Present'),
    count(*) filter(where status='Absent'),
    count(*) filter(where status='Late'),
    count(*) filter(where status='Leave'),
    count(*) filter(where status in ('Present','Absent','Late'))
  into present_count,absent_count,late_count,leave_count,attendance_count
  from public.attendance_records a
  where a.student_id=st.id;

  if attendance_count>0 then
    attendance_pct:=round(((present_count+late_count)::numeric/attendance_count)*100,2);
  end if;

  select coalesce(max(p.version_no),0)+1
    into v_version
  from public.report_card_publications p
  where p.student_id=st.id
    and p.report_type=normalized_type;

  normalized_title:=coalesce(
    nullif(btrim(coalesce(p_title,'')),''),
    normalized_type||' Report Card'
  );

  insert into public.report_card_publications(
    institution_id,student_id,report_type,title,version_no,snapshot,published_by
  )
  values(
    st.institution_id,
    st.id,
    normalized_type,
    normalized_title,
    v_version,
    jsonb_build_object(
      'student',jsonb_build_object(
        'id',st.id,
        'studentCode',st.student_code,
        'name',st.name,
        'guardian',st.guardian_name,
        'className',st.class_name,
        'sectionName',st.section_name,
        'rollNo',st.roll_no,
        'admissionNo',st.admission_no
      ),
      'reportType',normalized_type,
      'subjects',subjects_json,
      'obtained',obtained,
      'total',total_marks,
      'overall',overall,
      'grade',v_grade,
      'status',case when overall>=40 then 'Pass' else 'Needs Support' end,
      'attendance',jsonb_build_object(
        'present',present_count,
        'absent',absent_count,
        'late',late_count,
        'leave',leave_count,
        'percentage',attendance_pct
      ),
      'generatedAt',now()
    ),
    uid
  )
  returning * into out_row;

  insert into public.user_notifications(
    institution_id,recipient_user_id,created_by,category,title,body
  )
  select
    st.institution_id,
    recipient,
    uid,
    'report_card',
    'Report card published',
    left(st.name||' · '||normalized_type||' · '||overall||'%',180)
  from (
    select st.auth_user_id as recipient
    where st.auth_user_id is not null
    union
    select l.parent_user_id
    from public.parent_student_links l
    where l.institution_id=st.institution_id
      and l.student_user_id=st.auth_user_id
      and l.status='approved'
  ) q
  where recipient is not null
    and recipient<>uid;

  return out_row;
end;
$function$;

revoke all on function private.publish_report_card_v2_impl(uuid,text,text) from public, anon;
grant execute on function private.publish_report_card_v2_impl(uuid,text,text) to authenticated;

create or replace function public.publish_report_card_v1(
  p_student_id uuid,
  p_report_type text default null,
  p_title text default null
)
returns public.report_card_publications
language sql
set search_path=''
as $function$
  select private.publish_report_card_v2_impl(p_student_id,p_report_type,p_title);
$function$;

revoke all on function public.publish_report_card_v1(uuid,text,text) from public, anon;
grant execute on function public.publish_report_card_v1(uuid,text,text) to authenticated;

create or replace function private.acknowledge_report_card_v2_impl(
  p_publication_id uuid
)
returns public.report_card_acknowledgements
language plpgsql
security definer
set search_path=''
as $function$
declare
  uid uuid := (select auth.uid());
  r text := public.current_account_role();
  pub public.report_card_publications%rowtype;
  out_row public.report_card_acknowledgements%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if r not in ('student','parent') then raise exception 'Student or Parent account required'; end if;

  select * into pub
  from public.report_card_publications p
  where p.id=p_publication_id
    and p.status='Published';

  if pub.id is null then raise exception 'Published report card not found'; end if;

  if not (select private.can_access_core_student_v2(pub.student_id,uid)) then
    raise exception 'You are not allowed to acknowledge this report card';
  end if;

  insert into public.report_card_acknowledgements(
    publication_id,viewer_user_id,viewer_role,acknowledged_at
  )
  values(p_publication_id,uid,r,now())
  on conflict(publication_id,viewer_user_id)
  do update set viewer_role=excluded.viewer_role,acknowledged_at=now()
  returning * into out_row;

  return out_row;
end;
$function$;

revoke all on function private.acknowledge_report_card_v2_impl(uuid) from public, anon;
grant execute on function private.acknowledge_report_card_v2_impl(uuid) to authenticated;

create or replace function public.acknowledge_report_card_v1(
  p_publication_id uuid
)
returns public.report_card_acknowledgements
language sql
set search_path=''
as $function$
  select private.acknowledge_report_card_v2_impl(p_publication_id);
$function$;

revoke all on function public.acknowledge_report_card_v1(uuid) from public, anon;
grant execute on function public.acknowledge_report_card_v1(uuid) to authenticated;

revoke insert,update,delete on table public.report_card_publications from authenticated;
revoke insert,update,delete on table public.report_card_acknowledgements from authenticated;

revoke all privileges on table
  public.result_records,
  public.exam_schedule_entries,
  public.student_remarks
from anon;
