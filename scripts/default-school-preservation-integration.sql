-- Execute both rewritten RPCs against disposable rows and assert preservation/fill semantics.
do $test$
declare
  old_school constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  requested_school constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  student_existing constant uuid := '11111111-1111-4111-8111-111111111111';
  student_empty constant uuid := '22222222-2222-4222-8222-222222222222';
  teacher_existing constant uuid := '33333333-3333-4333-8333-333333333333';
  teacher_empty constant uuid := '44444444-4444-4444-8444-444444444444';
  actual uuid;
begin
  insert into public.user_profiles(user_id,account_role,institution_id)
  values(student_existing,'student',old_school),(teacher_existing,'teacher',old_school);

  perform private.decide_school_access_request_v1(student_existing,true,requested_school::text);
  select institution_id into actual from public.user_profiles where user_id=student_existing;
  if actual is distinct from old_school then raise exception 'Student/Parent RPC overwrote an existing default school'; end if;

  perform private.decide_school_access_request_v1(student_empty,true,requested_school::text);
  select institution_id into actual from public.user_profiles where user_id=student_empty;
  if actual is distinct from requested_school then raise exception 'Student/Parent RPC did not fill a missing default school'; end if;

  perform private.decide_teacher_school_request_v1(teacher_existing,true,requested_school::text);
  select institution_id into actual from public.user_profiles where user_id=teacher_existing;
  if actual is distinct from old_school then raise exception 'Teacher RPC overwrote an existing default school'; end if;

  perform private.decide_teacher_school_request_v1(teacher_empty,true,requested_school::text);
  select institution_id into actual from public.user_profiles where user_id=teacher_empty;
  if actual is distinct from requested_school then raise exception 'Teacher RPC did not fill a missing default school'; end if;
end;
$test$;

select 'Default-school preservation integration checks passed.' as result;
