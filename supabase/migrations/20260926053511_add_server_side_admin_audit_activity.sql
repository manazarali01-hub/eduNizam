-- Applied in Supabase migration history: add_server_side_admin_audit_activity
-- Server-side audit trail for sensitive school operations. Sensitive CNIC/password/GPS fields are deliberately excluded.

create index if not exists audit_logs_institution_created_idx
on public.audit_logs(institution_id,created_at desc);

create or replace function private.capture_admin_audit_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row jsonb;
  v_inst uuid;
  v_actor uuid;
  v_entity_id text;
  v_details jsonb:='{}'::jsonb;
begin
  v_row:=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
  v_inst:=nullif(v_row->>'institution_id','')::uuid;
  v_actor:=auth.uid();

  if v_inst is null then
    return case when TG_OP='DELETE' then OLD else NEW end;
  end if;

  v_entity_id:=coalesce(
    nullif(v_row->>'id',''),
    case
      when TG_TABLE_NAME='teacher_student_links' then concat_ws(':',v_row->>'teacher_user_id',v_row->>'student_user_id')
      when TG_TABLE_NAME='parent_student_links' then concat_ws(':',v_row->>'parent_user_id',v_row->>'student_user_id')
      when TG_TABLE_NAME='institution_settings' then v_row->>'institution_id'
      else null
    end
  );

  v_details:=case TG_TABLE_NAME
    when 'attendance_records' then jsonb_build_object('student_id',v_row->>'student_id','date',v_row->>'attendance_date','status',v_row->>'status')
    when 'staff_attendance_records' then jsonb_build_object('staff_profile_id',v_row->>'staff_profile_id','date',v_row->>'attendance_date','status',v_row->>'status','check_in_at',v_row->>'check_in_at','check_out_at',v_row->>'check_out_at')
    when 'fee_records' then jsonb_build_object('student_id',v_row->>'student_id','amount',v_row->>'amount','status',v_row->>'status','fee_month',v_row->>'fee_month')
    when 'result_records' then jsonb_build_object('student_id',v_row->>'student_id','subject',v_row->>'subject','assessment_type',v_row->>'assessment_type','marks',v_row->>'marks','total',v_row->>'total')
    when 'leave_requests' then jsonb_build_object('submitted_by',v_row->>'submitted_by','requester_role',v_row->>'requester_role','leave_for',v_row->>'leave_for','from_date',v_row->>'from_date','to_date',v_row->>'to_date','status',v_row->>'status')
    when 'school_access_requests' then jsonb_build_object('requester_user_id',v_row->>'requester_user_id','requested_role',v_row->>'requested_role','status',v_row->>'status','full_name',v_row->>'full_name')
    when 'core_students' then jsonb_build_object('name',v_row->>'name','class_name',v_row->>'class_name','section_name',v_row->>'section_name','student_code',v_row->>'student_code')
    when 'teacher_student_links' then jsonb_build_object('teacher_user_id',v_row->>'teacher_user_id','student_user_id',v_row->>'student_user_id')
    when 'parent_student_links' then jsonb_build_object('parent_user_id',v_row->>'parent_user_id','student_user_id',v_row->>'student_user_id','status',v_row->>'status')
    when 'applications' then jsonb_build_object('applicant_user_id',v_row->>'applicant_user_id','application_no',v_row->>'application_no','applicant_name',v_row->>'applicant_name','program',v_row->>'program','status',v_row->>'status','fee_status',v_row->>'fee_status')
    when 'payment_records' then jsonb_build_object('application_id',v_row->>'application_id','method',v_row->>'method','amount',v_row->>'amount','status',v_row->>'status')
    when 'student_parent_complaints' then jsonb_build_object('student_id',v_row->>'student_id','severity',v_row->>'severity','status',v_row->>'status','subject',v_row->>'subject')
    when 'school_helpdesk_tickets' then jsonb_build_object('ticket_no',v_row->>'ticket_no','category',v_row->>'category','priority',v_row->>'priority','status',v_row->>'status')
    when 'institution_settings' then jsonb_build_object('school_name',v_row->>'school_name','school_type',v_row->>'school_type','academic_session',v_row->>'academic_session')
    else '{}'::jsonb
  end;

  begin
    insert into public.audit_logs(institution_id,user_id,action,entity_type,entity_id,details)
    values(v_inst,v_actor,lower(TG_OP),TG_TABLE_NAME,v_entity_id,v_details);
  exception when others then
    raise warning 'EduNizam audit capture failed for %.%: %',TG_TABLE_SCHEMA,TG_TABLE_NAME,SQLERRM;
  end;

  return case when TG_OP='DELETE' then OLD else NEW end;
end;
$$;

revoke execute on function private.capture_admin_audit_v1() from public,anon,authenticated;

drop trigger if exists audit_attendance_records on public.attendance_records;
create trigger audit_attendance_records after insert or update or delete on public.attendance_records for each row execute function private.capture_admin_audit_v1();
drop trigger if exists audit_staff_attendance_records on public.staff_attendance_records;
create trigger audit_staff_attendance_records after insert or update or delete on public.staff_attendance_records for each row execute function private.capture_admin_audit_v1();
drop trigger if exists audit_fee_records on public.fee_records;
create trigger audit_fee_records after insert or update or delete on public.fee_records for each row execute function private.capture_admin_audit_v1();
drop trigger if exists audit_result_records on public.result_records;
create trigger audit_result_records after insert or update or delete on public.result_records for each row execute function private.capture_admin_audit_v1();
drop trigger if exists audit_leave_requests on public.leave_requests;
create trigger audit_leave_requests after insert or update or delete on public.leave_requests for each row execute function private.capture_admin_audit_v1();
drop trigger if exists audit_school_access_requests on public.school_access_requests;
create trigger audit_school_access_requests after insert or update or delete on public.school_access_requests for each row execute function private.capture_admin_audit_v1();
drop trigger if exists audit_core_students on public.core_students;
create trigger audit_core_students after insert or update or delete on public.core_students for each row execute function private.capture_admin_audit_v1();
drop trigger if exists audit_teacher_student_links on public.teacher_student_links;
create trigger audit_teacher_student_links after insert or update or delete on public.teacher_student_links for each row execute function private.capture_admin_audit_v1();
drop trigger if exists audit_parent_student_links on public.parent_student_links;
create trigger audit_parent_student_links after insert or update or delete on public.parent_student_links for each row execute function private.capture_admin_audit_v1();
drop trigger if exists audit_applications on public.applications;
create trigger audit_applications after insert or update or delete on public.applications for each row execute function private.capture_admin_audit_v1();
drop trigger if exists audit_payment_records on public.payment_records;
create trigger audit_payment_records after insert or update or delete on public.payment_records for each row execute function private.capture_admin_audit_v1();
drop trigger if exists audit_student_parent_complaints on public.student_parent_complaints;
create trigger audit_student_parent_complaints after insert or update or delete on public.student_parent_complaints for each row execute function private.capture_admin_audit_v1();
drop trigger if exists audit_school_helpdesk_tickets on public.school_helpdesk_tickets;
create trigger audit_school_helpdesk_tickets after insert or update or delete on public.school_helpdesk_tickets for each row execute function private.capture_admin_audit_v1();
drop trigger if exists audit_institution_settings on public.institution_settings;
create trigger audit_institution_settings after insert or update or delete on public.institution_settings for each row execute function private.capture_admin_audit_v1();
