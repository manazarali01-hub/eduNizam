-- Minimal isolated PostgreSQL fixture for the invite-claim migration.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create schema private;
create or replace function auth.uid()
returns uuid language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth,private to authenticated;
grant execute on function auth.uid() to authenticated;

create table public.institutions (
  id uuid primary key,
  name text not null
);
create table public.institution_invites (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  code text not null unique,
  target_role text not null check (target_role in ('teacher','student','parent')),
  created_by uuid not null,
  expires_at timestamptz,
  max_uses integer not null default 1 check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.user_profiles (
  user_id uuid primary key,
  account_role text not null check (account_role in ('student','parent','teacher','head_of_institute')),
  institution_id uuid references public.institutions(id),
  updated_at timestamptz not null default now()
);
create table public.institution_members (
  institution_id uuid not null references public.institutions(id),
  user_id uuid not null,
  role text not null check (role in ('student','parent','teacher','head_of_institute')),
  created_at timestamptz not null default now(),
  primary key (institution_id,user_id)
);
grant select on public.institutions,public.institution_invites,public.user_profiles,public.institution_members to authenticated;

insert into public.institutions(id,name) values
 ('10000000-0000-0000-0000-000000000001','School A'),
 ('10000000-0000-0000-0000-000000000002','School B');

insert into public.institution_invites(id,institution_id,code,target_role,created_by,max_uses)
values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','HEAD-STUDENT','student','90000000-0000-0000-0000-000000000001',1),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','TEACHER-PARENT','parent','90000000-0000-0000-0000-000000000001',1),
 ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','STUDENT-SECOND','student','90000000-0000-0000-0000-000000000001',1),
 ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','PARENT-SECOND','parent','90000000-0000-0000-0000-000000000001',1),
 ('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','STUDENT-PARENT','parent','90000000-0000-0000-0000-000000000001',1),
 ('30000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000002','NEW-STUDENT','student','90000000-0000-0000-0000-000000000001',1);

insert into public.user_profiles(user_id,account_role,institution_id) values
 ('20000000-0000-0000-0000-000000000001','head_of_institute','10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','teacher','10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000003','student','10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000004','parent','10000000-0000-0000-0000-000000000001');

insert into public.institution_members(institution_id,user_id,role) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','head_of_institute'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','teacher'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','student'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','parent');
