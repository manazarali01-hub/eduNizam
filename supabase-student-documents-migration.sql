-- EduNizam Student ID Cards & Certificates upgrade migration
-- =========================================================
-- EduNizam Student ID Cards & Certificates
-- =========================================================
begin;

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.core_students(id) on delete cascade,
  document_type text not null check (document_type in ('ID Card','Bonafide Certificate','Enrollment Certificate','Leaving Certificate')),
  document_no text not null,
  issue_date date not null,
  remarks text,
  issued_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(institution_id,document_no)
);
alter table public.student_documents enable row level security;

drop policy if exists "heads manage student documents" on public.student_documents;
create policy "heads manage student documents" on public.student_documents
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=student_documents.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=student_documents.institution_id and i.owner_user_id=auth.uid())
);

drop policy if exists "students read own documents" on public.student_documents;
create policy "students read own documents" on public.student_documents
for select to authenticated
using (
  exists(select 1 from public.core_students s where s.id=student_documents.student_id and s.auth_user_id=auth.uid())
);

drop policy if exists "parents read linked student documents" on public.student_documents;
create policy "parents read linked student documents" on public.student_documents
for select to authenticated
using (
  exists(
    select 1
    from public.core_students s
    join public.parent_student_links l
      on l.student_user_id=s.auth_user_id
     and l.parent_user_id=auth.uid()
     and l.status='approved'
    where s.id=student_documents.student_id
      and l.institution_id=student_documents.institution_id
  )
);

commit;


