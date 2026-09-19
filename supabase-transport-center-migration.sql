-- EduNizam Transport & Route Management upgrade migration
-- =========================================================
-- EduNizam Transport & Route Management
-- =========================================================
begin;

create table if not exists public.transport_routes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  route_code text not null,
  route_name text not null,
  pickup_time time,
  drop_time time,
  monthly_fee numeric(12,2) not null default 0 check (monthly_fee >= 0),
  stops text[] not null default '{}',
  active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id,route_code)
);
alter table public.transport_routes enable row level security;

create table if not exists public.transport_vehicles (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  registration_no text not null,
  vehicle_type text not null default 'Van',
  capacity integer not null check (capacity > 0),
  driver_name text,
  driver_phone text,
  conductor_name text,
  conductor_phone text,
  status text not null default 'active' check (status in ('active','maintenance','inactive')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id,registration_no)
);
alter table public.transport_vehicles enable row level security;

create table if not exists public.student_transport_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.core_students(id) on delete cascade,
  route_id uuid not null references public.transport_routes(id) on delete restrict,
  vehicle_id uuid not null references public.transport_vehicles(id) on delete restrict,
  pickup_stop text,
  drop_stop text,
  effective_from date not null default current_date,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id)
);
alter table public.student_transport_assignments enable row level security;

drop policy if exists "heads manage transport routes" on public.transport_routes;
create policy "heads manage transport routes" on public.transport_routes
for all to authenticated
using (exists(select 1 from public.institutions i where i.id=transport_routes.institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=transport_routes.institution_id and i.owner_user_id=auth.uid()));

drop policy if exists "heads manage transport vehicles" on public.transport_vehicles;
create policy "heads manage transport vehicles" on public.transport_vehicles
for all to authenticated
using (exists(select 1 from public.institutions i where i.id=transport_vehicles.institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=transport_vehicles.institution_id and i.owner_user_id=auth.uid()));

drop policy if exists "heads manage transport assignments" on public.student_transport_assignments;
create policy "heads manage transport assignments" on public.student_transport_assignments
for all to authenticated
using (exists(select 1 from public.institutions i where i.id=student_transport_assignments.institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=student_transport_assignments.institution_id and i.owner_user_id=auth.uid()));

drop policy if exists "users read own transport assignments" on public.student_transport_assignments;
create policy "users read own transport assignments" on public.student_transport_assignments
for select to authenticated
using (public.can_access_core_student(student_id));

create or replace function public.list_my_transport_assignments()
returns table(
  id uuid,
  student_id uuid,
  student_local_id bigint,
  student_name text,
  class_name text,
  section_name text,
  route_id uuid,
  route_name text,
  vehicle_id uuid,
  registration_no text,
  driver_name text,
  driver_phone text,
  pickup_stop text,
  drop_stop text,
  monthly_fee numeric,
  effective_from date,
  status text
)
language sql
stable
security definer
set search_path=public
as $$
  select
    a.id,a.student_id,s.local_id,s.name,s.class_name,s.section_name,
    a.route_id,r.route_name,a.vehicle_id,v.registration_no,v.driver_name,v.driver_phone,
    a.pickup_stop,a.drop_stop,r.monthly_fee,a.effective_from,a.status
  from public.student_transport_assignments a
  join public.core_students s on s.id=a.student_id
  join public.transport_routes r on r.id=a.route_id
  join public.transport_vehicles v on v.id=a.vehicle_id
  where
    exists(select 1 from public.institutions i where i.id=a.institution_id and i.owner_user_id=auth.uid())
    or public.can_access_core_student(a.student_id)
  order by s.name;
$$;
grant execute on function public.list_my_transport_assignments() to authenticated;

create or replace function public.assign_student_transport(
  p_student_id uuid,
  p_route_id uuid,
  p_vehicle_id uuid,
  p_pickup_stop text,
  p_drop_stop text,
  p_effective_from date
)
returns public.student_transport_assignments
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.core_students%rowtype;
  r public.transport_routes%rowtype;
  v public.transport_vehicles%rowtype;
  used integer;
  result_row public.student_transport_assignments%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into s from public.core_students where id=p_student_id;
  select * into r from public.transport_routes where id=p_route_id;
  select * into v from public.transport_vehicles where id=p_vehicle_id for update;

  if s.id is null or r.id is null or v.id is null then raise exception 'Student, route or vehicle not found'; end if;
  if s.institution_id<>r.institution_id or s.institution_id<>v.institution_id then raise exception 'Transport records must belong to one institution'; end if;
  if not exists(select 1 from public.institutions i where i.id=s.institution_id and i.owner_user_id=auth.uid()) then raise exception 'Head access required'; end if;
  if not r.active then raise exception 'Route is inactive'; end if;
  if v.status<>'active' then raise exception 'Vehicle is not active'; end if;

  select count(*) into used
  from public.student_transport_assignments a
  where a.vehicle_id=v.id and a.status='active' and a.student_id<>s.id;

  if used >= v.capacity then raise exception 'Vehicle capacity is full'; end if;

  insert into public.student_transport_assignments(
    institution_id,student_id,route_id,vehicle_id,pickup_stop,drop_stop,effective_from,status,created_by
  ) values(
    s.institution_id,s.id,r.id,v.id,nullif(trim(p_pickup_stop),''),nullif(trim(p_drop_stop),''),
    coalesce(p_effective_from,current_date),'active',auth.uid()
  )
  on conflict(student_id) do update set
    route_id=excluded.route_id,
    vehicle_id=excluded.vehicle_id,
    pickup_stop=excluded.pickup_stop,
    drop_stop=excluded.drop_stop,
    effective_from=excluded.effective_from,
    status='active',
    updated_at=now()
  returning * into result_row;

  return result_row;
end;
$$;
grant execute on function public.assign_student_transport(uuid,uuid,uuid,text,text,date) to authenticated;

commit;


