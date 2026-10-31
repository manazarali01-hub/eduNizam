create schema if not exists auth;
create schema if not exists private;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create or replace function auth.uid()
returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;

create table public.institution_members (
  institution_id uuid not null, user_id uuid not null, role text not null,
  primary key(institution_id,user_id)
);
create table public.teacher_student_links (
  institution_id uuid not null, teacher_user_id uuid not null, student_user_id uuid not null
);
create table public.core_students (
  institution_id uuid not null, auth_user_id uuid not null, class_name text, section_name text
);
create table public.class_sections (
  institution_id uuid not null, class_name text not null, section_name text,
  active boolean, class_teacher_user_id uuid
);
create table public.institutions (id uuid primary key, owner_user_id uuid not null);
create table public.leave_requests (
  id uuid primary key, institution_id uuid not null, student_user_id uuid,
  submitted_by uuid not null, leave_for text not null,
  from_date date not null, to_date date not null,
  status text not null default 'Pending', decision_note text,
  decided_by uuid, decided_at timestamptz,
  teacher_response text, teacher_note text, teacher_reviewed_by uuid,
  teacher_reviewed_at timestamptz,
  attachment_path text, attachment_name text, attachment_type text,
  number_of_days integer default 1,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
