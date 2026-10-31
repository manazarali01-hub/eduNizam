-- Harden leave attachment/submission RPCs and repair two production leave-flow bugs.
-- 1) notify_leave_submission_v1 referenced nonexistent teacher_student_links.status.
-- 2) guard_leave_review_v2 rejected legitimate requester attachment-only updates.
-- Public RPC signatures remain SECURITY INVOKER wrappers over private SECURITY DEFINER implementations.
-- Applied to production on 2026-10-06 after bug reproduction, rollback regression, and post-apply regression.
-- Supabase authenticated SECURITY DEFINER advisor findings reduced from 14 to 12.

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

    -- Only the original requester may make an attachment-only change while Pending.
    -- number_of_days is already a review-safe derived field in this workflow.
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
      if old.leave_for<>'student' or not exists(
        select 1
        from public.teacher_student_links t
        join public.institution_members m
          on m.institution_id=t.institution_id
         and m.user_id=t.teacher_user_id
         and m.role='teacher'
        where t.institution_id=old.institution_id
          and t.student_user_id=old.student_user_id
          and t.teacher_user_id=uid
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

create or replace function private.attach_leave_file_v2(
  p_request_id uuid,
  p_storage_path text,
  p_name text,
  p_type text
)
returns public.leave_requests
language plpgsql security definer set search_path=''
as $$
declare
  v_row public.leave_requests;
  v_uid uuid := (select auth.uid());
  v_prefix text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  if nullif(btrim(coalesce(p_storage_path,'')),'') is null then
    raise exception 'Storage path required';
  end if;

  select * into v_row
  from public.leave_requests
  where id=p_request_id;

  if v_row.id is null then raise exception 'Leave request not found'; end if;
  if v_row.submitted_by<>v_uid then
    raise exception 'Only the requester can attach a file';
  end if;
  if v_row.status<>'Pending' then
    raise exception 'Attachments can only be changed while leave is pending';
  end if;

  v_prefix:=v_row.institution_id::text||'/'||p_request_id::text||'/'||v_uid::text||'/';

  if left(p_storage_path,length(v_prefix))<>v_prefix then
    raise exception 'Invalid attachment path';
  end if;

  update public.leave_requests
  set attachment_path=p_storage_path,
      attachment_name=nullif(btrim(coalesce(p_name,'')),''),
      attachment_type=nullif(btrim(coalesce(p_type,'')),''),
      updated_at=now()
  where id=p_request_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function private.notify_leave_submission_v2(
  p_request_id uuid
)
returns integer
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_leave public.leave_requests%rowtype;
  v_count integer := 0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_leave
  from public.leave_requests
  where id=p_request_id;

  if not found then raise exception 'Leave request not found'; end if;
  if v_leave.submitted_by<>v_uid then
    raise exception 'Only the requester can notify submission';
  end if;

  insert into public.user_notifications(
    institution_id,recipient_user_id,created_by,title,body,category
  )
  select
    v_leave.institution_id,
    r.user_id,
    v_uid,
    case
      when v_leave.leave_for='staff' then 'New teacher leave request'
      else 'New student leave request'
    end,
    coalesce(v_leave.requester_name,v_leave.student_name,'User')
      ||' · '||v_leave.from_date::text
      ||' to '||v_leave.to_date::text
      ||' · '||coalesce(v_leave.reason,''),
    'leave'
  from (
    select i.owner_user_id as user_id
    from public.institutions i
    where i.id=v_leave.institution_id

    union

    select tsl.teacher_user_id
    from public.teacher_student_links tsl
    join public.institution_members m
      on m.institution_id=tsl.institution_id
     and m.user_id=tsl.teacher_user_id
     and m.role='teacher'
    where v_leave.leave_for='student'
      and tsl.institution_id=v_leave.institution_id
      and tsl.student_user_id=v_leave.student_user_id
  ) r
  where r.user_id is not null
    and r.user_id<>v_uid
    and not exists(
      select 1
      from public.user_notifications n
      where n.institution_id=v_leave.institution_id
        and n.recipient_user_id=r.user_id
        and n.created_by=v_uid
        and n.category='leave'
        and n.title=case
          when v_leave.leave_for='staff' then 'New teacher leave request'
          else 'New student leave request'
        end
        and n.created_at>v_leave.created_at-interval '1 minute'
    );

  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function private.attach_leave_file_v2(uuid,text,text,text) from public,anon;
revoke all on function private.notify_leave_submission_v2(uuid) from public,anon;

grant execute on function private.attach_leave_file_v2(uuid,text,text,text) to authenticated;
grant execute on function private.notify_leave_submission_v2(uuid) to authenticated;

create or replace function public.attach_leave_file_v1(
  p_request_id uuid,
  p_storage_path text,
  p_name text,
  p_type text
)
returns public.leave_requests
language sql security invoker set search_path=''
as $$
  select private.attach_leave_file_v2(
    p_request_id,p_storage_path,p_name,p_type
  );
$$;

create or replace function public.notify_leave_submission_v1(
  p_request_id uuid
)
returns integer
language sql security invoker set search_path=''
as $$
  select private.notify_leave_submission_v2(p_request_id);
$$;

revoke all on function public.attach_leave_file_v1(uuid,text,text,text) from public,anon;
revoke all on function public.notify_leave_submission_v1(uuid) from public,anon;

grant execute on function public.attach_leave_file_v1(uuid,text,text,text) to authenticated;
grant execute on function public.notify_leave_submission_v1(uuid) to authenticated;
