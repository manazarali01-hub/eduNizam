-- EduNizam Physical Library Circulation upgrade migration
-- =========================================================
-- EduNizam Physical Library Circulation
-- =========================================================
begin;

create table if not exists public.library_books (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  accession_no text not null,
  title text not null,
  author text,
  isbn text,
  category text not null default 'General',
  publisher text,
  shelf_location text,
  total_copies integer not null default 1 check (total_copies > 0),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id,accession_no)
);

alter table public.library_books enable row level security;

create table if not exists public.library_loans (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  book_id uuid not null references public.library_books(id) on delete restrict,
  student_id uuid not null references public.core_students(id) on delete cascade,
  issued_at date not null default current_date,
  due_date date not null,
  returned_at date,
  notes text,
  issued_by uuid references auth.users(id) on delete set null,
  returned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date >= issued_at)
);

create unique index if not exists library_active_book_student_idx
on public.library_loans(book_id,student_id)
where returned_at is null;

create index if not exists library_loans_institution_due_idx
on public.library_loans(institution_id,due_date);

alter table public.library_loans enable row level security;

drop policy if exists "institution users read library books" on public.library_books;
create policy "institution users read library books" on public.library_books
for select to authenticated
using (public.is_institution_user(institution_id));

drop policy if exists "heads manage library books" on public.library_books;
create policy "heads manage library books" on public.library_books
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=library_books.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=library_books.institution_id and i.owner_user_id=auth.uid())
);

drop policy if exists "users read accessible library loans" on public.library_loans;
create policy "users read accessible library loans" on public.library_loans
for select to authenticated
using (
  public.is_institution_staff(institution_id)
  or public.can_access_core_student(student_id)
);

create or replace function public.issue_library_book(p_book_id uuid,p_student_id uuid,p_due_date date)
returns public.library_loans
language plpgsql
security definer
set search_path=public
as $$
declare
  b public.library_books%rowtype;
  s public.core_students%rowtype;
  active_count integer;
  r text;
  result_row public.library_loans%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_due_date is null or p_due_date < current_date then raise exception 'Due date must be today or later'; end if;

  select * into b from public.library_books where id=p_book_id for update;
  if b.id is null or not b.active then raise exception 'Book is not available'; end if;

  select * into s from public.core_students where id=p_student_id and institution_id=b.institution_id;
  if s.id is null then raise exception 'Student is not in this institution'; end if;

  r:=public.current_account_role();
  if r='head_of_institute' then
    if not exists(select 1 from public.institutions i where i.id=b.institution_id and i.owner_user_id=auth.uid()) then
      raise exception 'Head access required';
    end if;
  elsif r='teacher' then
    if not exists(
      select 1 from public.teacher_student_links tsl
      where tsl.institution_id=b.institution_id
        and tsl.teacher_user_id=auth.uid()
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
  values(b.institution_id,b.id,s.id,p_due_date,auth.uid())
  returning * into result_row;

  return result_row;
end;
$$;
grant execute on function public.issue_library_book(uuid,uuid,date) to authenticated;

create or replace function public.return_library_book(p_loan_id uuid)
returns public.library_loans
language plpgsql
security definer
set search_path=public
as $$
declare
  l public.library_loans%rowtype;
  s public.core_students%rowtype;
  r text;
  result_row public.library_loans%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into l from public.library_loans where id=p_loan_id for update;
  if l.id is null then raise exception 'Loan not found'; end if;
  if l.returned_at is not null then return l; end if;

  select * into s from public.core_students where id=l.student_id;
  r:=public.current_account_role();

  if r='head_of_institute' then
    if not exists(select 1 from public.institutions i where i.id=l.institution_id and i.owner_user_id=auth.uid()) then
      raise exception 'Head access required';
    end if;
  elsif r='teacher' then
    if not exists(
      select 1 from public.teacher_student_links tsl
      where tsl.institution_id=l.institution_id
        and tsl.teacher_user_id=auth.uid()
        and tsl.student_user_id=s.auth_user_id
    ) then raise exception 'Teacher can return books only for assigned students'; end if;
  else
    raise exception 'Staff access required';
  end if;

  update public.library_loans
  set returned_at=current_date,returned_by=auth.uid(),updated_at=now()
  where id=l.id
  returning * into result_row;

  return result_row;
end;
$$;
grant execute on function public.return_library_book(uuid) to authenticated;

commit;


