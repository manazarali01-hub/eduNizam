\set ON_ERROR_STOP on
begin;
create trigger guard_leave_review_before_update
before update on public.leave_requests
for each row execute function private.guard_leave_review_v2();
insert into public.institution_members values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','teacher'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','teacher'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','teacher');
insert into public.institutions values
('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
insert into public.core_students values
('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Class 5','A'),
('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','Class 6','B');
insert into public.class_sections values
('10000000-0000-0000-0000-000000000001','Class 5','A',true,'20000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000001','Class 6','B',true,'20000000-0000-0000-0000-000000000002');
insert into public.teacher_student_links values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000002');

insert into public.leave_requests(id,institution_id,student_user_id,submitted_by,leave_for,from_date,to_date)
values
('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','student',current_date,current_date),
('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000002','student',current_date,current_date),
('50000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000003','student',current_date,current_date);

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
update public.leave_requests
set teacher_response='Teacher Approved',teacher_note='Reviewed by assigned class teacher'
where id='50000000-0000-0000-0000-000000000001';
do $$ begin
 if not exists(select 1 from public.leave_requests where id='50000000-0000-0000-0000-000000000001' and teacher_reviewed_by='20000000-0000-0000-0000-000000000001' and teacher_reviewed_at is not null) then
  raise exception 'Class teacher review did not persist';
 end if;
end $$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
update public.leave_requests
set teacher_response='Teacher Approved',teacher_note='Assigned class teacher review'
where id='50000000-0000-0000-0000-000000000002';

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
update public.leave_requests
set teacher_response='Teacher Rejected',teacher_note='Linked teacher review'
where id='50000000-0000-0000-0000-000000000003';

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
do $$ begin
 begin
  update public.leave_requests set teacher_response='Teacher Approved',teacher_note='Not assigned'
  where id='50000000-0000-0000-0000-000000000001';
  raise exception 'Unassigned teacher unexpectedly updated leave';
 exception when others then
  if sqlerrm='Unassigned teacher unexpectedly updated leave' then raise; end if;
  if sqlerrm not like '%Assigned active teacher required%' then raise; end if;
 end;
end $$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
do $$ begin
 begin
  update public.leave_requests set status='Approved',decision_note='Teacher attempted final decision',
    teacher_response='Teacher Approved',teacher_note='Attempted final approval'
  where id='50000000-0000-0000-0000-000000000001';
  raise exception 'Teacher unexpectedly finalized leave';
 exception when others then
  if sqlerrm='Teacher unexpectedly finalized leave' then raise; end if;
  if sqlerrm not like '%Only School Admin can finalize leave%' then raise; end if;
 end;
end $$;

select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
update public.leave_requests set status='Approved',decision_note='School owner final approval'
where id='50000000-0000-0000-0000-000000000001';
do $$ begin
 if not exists(select 1 from public.leave_requests where id='50000000-0000-0000-0000-000000000001' and status='Approved' and decided_by='30000000-0000-0000-0000-000000000001' and decided_at is not null) then
  raise exception 'Institution owner final approval did not persist';
 end if;
end $$;

rollback;
select 'Class-teacher leave trigger behavior tests passed: assigned class teacher, linked teacher, unassigned teacher denied, teacher finalization denied, owner finalization allowed.' as result;
