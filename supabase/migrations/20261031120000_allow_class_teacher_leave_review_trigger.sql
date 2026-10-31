-- Allow assigned class teachers to submit the same pending-leave review
-- already permitted by leave_requests RLS. School owner remains the only
-- actor allowed to finalize a request as Approved/Rejected.

create or replace function private.is_assigned_leave_teacher_v1(
  p_institution_id uuid,
  p_student_user_id uuid,
  p_teacher_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    p_teacher_user_id is not null
    and p_teacher_user_id=(select auth.uid())
    and exists (
      select 1
      from public.institution_members m
      where m.institution_id=p_institution_id
        and m.user_id=p_teacher_user_id
        and m.role='teacher'
    )
    and (
      exists (
        select 1
        from public.teacher_student_links tsl
        where tsl.institution_id=p_institution_id
          and tsl.teacher_user_id=p_teacher_user_id
          and tsl.student_user_id=p_student_user_id
      )
      or exists (
        select 1
        from public.core_students s
        join public.class_sections cs
          on cs.institution_id=s.institution_id
         and lower(trim(cs.class_name))=lower(trim(coalesce(s.class_name,'')))
         and lower(trim(coalesce(cs.section_name,'')))=lower(trim(coalesce(s.section_name,'')))
         and coalesce(cs.active,true)=true
        where s.institution_id=p_institution_id
          and s.auth_user_id=p_student_user_id
          and cs.class_teacher_user_id=p_teacher_user_id
      )
    );
$$;

revoke all on function private.is_assigned_leave_teacher_v1(uuid,uuid,uuid)
  from public, anon;
grant execute on function private.is_assigned_leave_teacher_v1(uuid,uuid,uuid)
  to authenticated;

create or replace function private.guard_leave_review_v2()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  owner boolean;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if new.to_date<new.from_date then raise exception 'Invalid leave dates'; end if;

  if tg_op='INSERT' then
    if new.status<>'Pending'
       or new.decided_by is not null
       or new.decided_at is not null
       or new.teacher_response is not null
       or new.teacher_reviewed_by is not null
       or new.teacher_reviewed_at is not null
       or new.teacher_note is not null
       or nullif(new.decision_note,'') is not null then
      raise exception 'A new leave request must await review';
    end if;
    new.created_at:=now();
    new.updated_at:=now();
  else
    if old.status<>'Pending' then
      raise exception 'Leave already finalized';
    end if;

    if uid=old.submitted_by
       and (
         new.attachment_path is distinct from old.attachment_path
         or new.attachment_name is distinct from old.attachment_name
         or new.attachment_type is distinct from old.attachment_type
       )
       and (to_jsonb(new)-array[
         'attachment_path','attachment_name','attachment_type','updated_at','number_of_days'
       ]) is not distinct from
       (to_jsonb(old)-array[
         'attachment_path','attachment_name','attachment_type','updated_at','number_of_days'
       ]) then
      new.updated_at:=now();
      return new;
    end if;

    if (to_jsonb(new)-array[
      'number_of_days','status','decision_note','decided_by','decided_at',
      'updated_at','teacher_response','teacher_note','teacher_reviewed_by',
      'teacher_reviewed_at'
    ]) is distinct from
    (to_jsonb(old)-array[
      'number_of_days','status','decision_note','decided_by','decided_at',
      'updated_at','teacher_response','teacher_note','teacher_reviewed_by',
      'teacher_reviewed_at'
    ]) then
      raise exception 'Submitted leave details cannot be changed during review';
    end if;

    owner:=exists(
      select 1
      from public.institutions
      where id=old.institution_id
        and owner_user_id=uid
    );

    if owner then
      new.teacher_response:=old.teacher_response;
      new.teacher_note:=old.teacher_note;
      new.teacher_reviewed_by:=old.teacher_reviewed_by;
      new.teacher_reviewed_at:=old.teacher_reviewed_at;

      if new.status not in ('Approved','Rejected')
         or nullif(btrim(new.decision_note),'') is null then
        raise exception 'Final decision and reason required';
      end if;

      new.decided_by:=uid;
      new.decided_at:=now();
    else
      if old.leave_for<>'student'
         or not private.is_assigned_leave_teacher_v1(
           old.institution_id,old.student_user_id,uid
         ) then
        raise exception 'Assigned active teacher required';
      end if;

      if new.status<>old.status
         or new.decided_by is distinct from old.decided_by
         or new.decided_at is distinct from old.decided_at
         or new.decision_note is distinct from old.decision_note then
        raise exception 'Only School Admin can finalize leave';
      end if;

      if new.teacher_response not in (
        'Teacher Approved','Teacher Rejected','Under Admin Review'
      ) or nullif(btrim(new.teacher_note),'') is null then
        raise exception 'Teacher response and reason required';
      end if;

      new.teacher_reviewed_by:=uid;
      new.teacher_reviewed_at:=now();
    end if;

    new.updated_at:=now();
  end if;

  return new;
end
$$;
