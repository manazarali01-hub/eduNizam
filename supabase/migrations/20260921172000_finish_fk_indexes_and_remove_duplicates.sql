-- EduNizam performance hardening: finish foreign-key index coverage and
-- remove two duplicate indexes created by the generic FK indexing pass.

begin;

create index if not exists fkidx_fee_records_student_id
  on public.fee_records(student_id);
create index if not exists fkidx_institution_members_user_id
  on public.institution_members(user_id);
create index if not exists fkidx_library_loans_student_id
  on public.library_loans(student_id);
create index if not exists fkidx_parent_student_links_student_user_id
  on public.parent_student_links(student_user_id);
create index if not exists fkidx_staff_profiles_user_id
  on public.staff_profiles(user_id);
create index if not exists fkidx_teacher_access_requests_requester_user_id
  on public.teacher_access_requests(requester_user_id);
create index if not exists fkidx_teacher_student_links_student_user_id
  on public.teacher_student_links(student_user_id);

drop index if exists public.fkidx_core_students_auth_user_id;
drop index if exists public.fkidx_core_students_institution_id;

commit;
