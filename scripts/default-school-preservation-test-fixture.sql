-- Minimal disposable PostgreSQL fixture for default-school preservation migration.
create schema if not exists private;
create table public.user_profiles (
  user_id uuid primary key,
  account_role text,
  full_name text,
  phone text,
  institution_id uuid,
  updated_at timestamptz
);

create or replace function private.decide_school_access_request_v1(p_request_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql as $function$
begin
  insert into public.user_profiles(user_id,account_role,full_name,phone,institution_id)
  values(p_request_id,'student','Fixture User',null,p_note::uuid)
  on conflict(user_id) do update
    set account_role=excluded.account_role,
        full_name=excluded.full_name,
        phone=excluded.phone,
        institution_id=excluded.institution_id,
        updated_at=now();
end;
$function$;

create or replace function private.decide_teacher_school_request_v1(p_request_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql as $function$
begin
  insert into public.user_profiles(user_id,account_role,full_name,phone,institution_id)
  values(p_request_id,'teacher','Fixture Teacher',null,p_note::uuid)
  on conflict(user_id) do update set
    account_role=excluded.account_role,full_name=excluded.full_name,phone=excluded.phone,
    institution_id=excluded.institution_id,updated_at=now();
end;
$function$;
