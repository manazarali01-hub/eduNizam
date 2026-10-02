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


create table if not exists public.school_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  item_id uuid not null references public.school_inventory_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('IN','OUT','ADJUST')),
  quantity_delta integer not null check (quantity_delta <> 0),
  before_quantity integer not null check (before_quantity >= 0),
  after_quantity integer not null check (after_quantity >= 0),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists school_inventory_movements_item_date_idx
on public.school_inventory_movements(institution_id,item_id,created_at desc);
alter table public.school_inventory_movements enable row level security;
drop policy if exists "staff read school inventory movements" on public.school_inventory_movements;
create policy "staff read school inventory movements" on public.school_inventory_movements for select to authenticated
using (public.is_institution_staff(institution_id));
drop policy if exists "heads manage school inventory movements" on public.school_inventory_movements;
create policy "heads manage school inventory movements" on public.school_inventory_movements for all to authenticated
using (exists(select 1 from public.institutions i where i.id=school_inventory_movements.institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=school_inventory_movements.institution_id and i.owner_user_id=auth.uid()));

create or replace function public.adjust_inventory_stock(p_item_id uuid,p_quantity_delta integer,p_note text default null)
returns public.school_inventory_items
language plpgsql
security definer
set search_path=public
as $$
declare item public.school_inventory_items%rowtype; after_qty integer; move_type text; result_row public.school_inventory_items%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_quantity_delta is null or p_quantity_delta=0 then raise exception 'Quantity change cannot be zero'; end if;
  select * into item from public.school_inventory_items where id=p_item_id for update;
  if item.id is null then raise exception 'Inventory item not found'; end if;
  if item.item_type<>'Stock Item' then raise exception 'Only Stock Item quantity can be adjusted through this action'; end if;
  if not exists(select 1 from public.institutions i where i.id=item.institution_id and i.owner_user_id=auth.uid()) then raise exception 'Head access required'; end if;
  after_qty:=item.quantity+p_quantity_delta;
  if after_qty<0 then raise exception 'Stock cannot go below zero'; end if;
  move_type:=case when p_quantity_delta>0 then 'IN' else 'OUT' end;
  update public.school_inventory_items set quantity=after_qty,updated_by=auth.uid(),updated_at=now() where id=item.id returning * into result_row;
  insert into public.school_inventory_movements(institution_id,item_id,movement_type,quantity_delta,before_quantity,after_quantity,note,created_by)
  values(item.institution_id,item.id,move_type,p_quantity_delta,item.quantity,after_qty,nullif(trim(p_note),''),auth.uid());
  return result_row;
end;
$$;
revoke execute on function public.adjust_inventory_stock(uuid,integer,text) from public;
revoke execute on function public.adjust_inventory_stock(uuid,integer,text) from anon;
grant execute on function public.adjust_inventory_stock(uuid,integer,text) to authenticated;

commit;


