-- EduNizam Inventory & Assets Center upgrade migration
-- =========================================================
-- EduNizam Inventory & Assets Management
-- =========================================================
begin;

create table if not exists public.school_inventory_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  item_code text not null,
  item_name text not null,
  item_type text not null check (item_type in ('Asset','Stock Item')),
  category text not null default 'Other',
  quantity integer not null default 1 check (quantity >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  condition text not null default 'Good' check (condition in ('Good','Needs Repair','Damaged','Retired')),
  location text,
  purchase_date date,
  assigned_staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id,item_code)
);

create index if not exists school_inventory_items_institution_idx
on public.school_inventory_items(institution_id,item_name);

alter table public.school_inventory_items enable row level security;

drop policy if exists "staff read school inventory" on public.school_inventory_items;
create policy "staff read school inventory" on public.school_inventory_items
for select to authenticated
using (public.is_institution_staff(institution_id));

drop policy if exists "heads manage school inventory" on public.school_inventory_items;
create policy "heads manage school inventory" on public.school_inventory_items
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=school_inventory_items.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=school_inventory_items.institution_id and i.owner_user_id=auth.uid())
  and (
    assigned_staff_profile_id is null
    or exists(
      select 1 from public.staff_profiles s
      where s.id=school_inventory_items.assigned_staff_profile_id
        and s.institution_id=school_inventory_items.institution_id
    )
  )
);

commit;


