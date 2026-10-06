-- Move privileged library mutations behind private SECURITY DEFINER implementations.
-- Public RPC signatures remain unchanged and now execute as SECURITY INVOKER.
-- Applied to production on 2026-10-06 after rollback-only Head/unauthorized regression tests.
-- Supabase authenticated SECURITY DEFINER advisor findings reduced from 36 to 33.

create or replace function private.issue_library_book_v1(p_book_id uuid, p_student_id uuid, p_due_date date)
returns public.library_loans
language plpgsql security definer set search_path=''
as $$
declare
  b public.library_books%rowtype;
  s public.core_students%rowtype;
  active_count integer;
  r text;
  uid uuid := (select auth.uid());
  result_row public.library_loans%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_due_date is null or p_due_date < current_date then raise exception 'Due date must be today or later'; end if;

  select * into b from public.library_books where id=p_book_id for update;
  if b.id is null or not b.active then raise exception 'Book is not available'; end if;

  select * into s from public.core_students where id=p_student_id and institution_id=b.institution_id;
  if s.id is null then raise exception 'Student is not in this institution'; end if;

  r:=private.current_account_role_v1(uid);
  if r='head_of_institute' then
    if not exists(select 1 from public.institutions i where i.id=b.institution_id and i.owner_user_id=uid) then
      raise exception 'Head access required';
    end if;
  elsif r='teacher' then
    if not exists(
      select 1 from public.teacher_student_links tsl
      where tsl.institution_id=b.institution_id
        and tsl.teacher_user_id=uid
        and tsl.student_user_id=s.auth_user_id
    ) then raise exception 'Teacher can issue books only to assigned students'; end if;
  else
    raise exception 'Staff access required';
  end if;

  select count(*) into active_count from public.library_loans
  where book_id=b.id and returned_at is null;

  if active_count >= b.total_copies then raise exception 'No copy is currently available'; end if;

  if exists(select 1 from public.library_loans where book_id=b.id and student_id=s.id and returned_at is null) then
    raise exception 'This student already has this book';
  end if;

  insert into public.library_loans(institution_id,book_id,student_id,due_date,issued_by)
  values(b.institution_id,b.id,s.id,p_due_date,uid)
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function private.renew_library_loan_v1(p_loan_id uuid, p_new_due_date date)
returns public.library_loans
language plpgsql security definer set search_path=''
as $$
declare
  l public.library_loans%rowtype;
  s public.core_students%rowtype;
  r text;
  uid uuid := (select auth.uid());
  result_row public.library_loans%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_new_due_date is null or p_new_due_date < current_date then raise exception 'New due date must be today or later'; end if;

  select * into l from public.library_loans where id=p_loan_id for update;
  if l.id is null then raise exception 'Loan not found'; end if;
  if l.returned_at is not null then raise exception 'Returned loan cannot be renewed'; end if;
  if p_new_due_date <= l.due_date then raise exception 'New due date must be later than current due date'; end if;

  select * into s from public.core_students where id=l.student_id;
  r:=private.current_account_role_v1(uid);

  if r='head_of_institute' then
    if not exists(select 1 from public.institutions i where i.id=l.institution_id and i.owner_user_id=uid) then
      raise exception 'Head access required';
    end if;
  elsif r='teacher' then
    if not exists(
      select 1 from public.teacher_student_links tsl
      where tsl.institution_id=l.institution_id
        and tsl.teacher_user_id=uid
        and tsl.student_user_id=s.auth_user_id
    ) then raise exception 'Teacher can renew books only for assigned students'; end if;
  else
    raise exception 'Staff access required';
  end if;

  update public.library_loans
  set due_date=p_new_due_date,updated_at=now()
  where id=l.id
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function private.return_library_book_v1(p_loan_id uuid)
returns public.library_loans
language plpgsql security definer set search_path=''
as $$
declare
  l public.library_loans%rowtype;
  s public.core_students%rowtype;
  r text;
  uid uuid := (select auth.uid());
  result_row public.library_loans%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into l from public.library_loans where id=p_loan_id for update;
  if l.id is null then raise exception 'Loan not found'; end if;
  if l.returned_at is not null then return l; end if;

  select * into s from public.core_students where id=l.student_id;
  r:=private.current_account_role_v1(uid);

  if r='head_of_institute' then
    if not exists(select 1 from public.institutions i where i.id=l.institution_id and i.owner_user_id=uid) then
      raise exception 'Head access required';
    end if;
  elsif r='teacher' then
    if not exists(
      select 1 from public.teacher_student_links tsl
      where tsl.institution_id=l.institution_id
        and tsl.teacher_user_id=uid
        and tsl.student_user_id=s.auth_user_id
    ) then raise exception 'Teacher can return books only for assigned students'; end if;
  else
    raise exception 'Staff access required';
  end if;

  update public.library_loans
  set returned_at=current_date,returned_by=uid,updated_at=now()
  where id=l.id
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function private.issue_library_book_v1(uuid,uuid,date) from public,anon;
revoke all on function private.renew_library_loan_v1(uuid,date) from public,anon;
revoke all on function private.return_library_book_v1(uuid) from public,anon;
grant execute on function private.issue_library_book_v1(uuid,uuid,date) to authenticated;
grant execute on function private.renew_library_loan_v1(uuid,date) to authenticated;
grant execute on function private.return_library_book_v1(uuid) to authenticated;

create or replace function public.issue_library_book(p_book_id uuid, p_student_id uuid, p_due_date date)
returns public.library_loans
language sql security invoker set search_path=''
as $$ select private.issue_library_book_v1(p_book_id,p_student_id,p_due_date); $$;

create or replace function public.renew_library_loan(p_loan_id uuid, p_new_due_date date)
returns public.library_loans
language sql security invoker set search_path=''
as $$ select private.renew_library_loan_v1(p_loan_id,p_new_due_date); $$;

create or replace function public.return_library_book(p_loan_id uuid)
returns public.library_loans
language sql security invoker set search_path=''
as $$ select private.return_library_book_v1(p_loan_id); $$;

revoke all on function public.issue_library_book(uuid,uuid,date) from public,anon;
revoke all on function public.renew_library_loan(uuid,date) from public,anon;
revoke all on function public.return_library_book(uuid) from public,anon;
grant execute on function public.issue_library_book(uuid,uuid,date) to authenticated;
grant execute on function public.renew_library_loan(uuid,date) to authenticated;
grant execute on function public.return_library_book(uuid) to authenticated;
