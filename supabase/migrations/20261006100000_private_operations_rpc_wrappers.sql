-- Harden Head-only inventory and transport mutation RPCs.
-- Public RPC signatures remain SECURITY INVOKER wrappers.
-- Privileged mutations live in private SECURITY DEFINER implementations with explicit Head authorization.
-- Applied to production on 2026-10-06 after rollback and post-apply regression.
-- Verified inventory movement integrity, non-negative stock, transport capacity and cross-institution constraints.
-- Supabase authenticated SECURITY DEFINER advisor findings reduced from 16 to 14.

create or replace function private.adjust_inventory_stock_v1(
  p_item_id uuid,
  p_quantity_delta integer,
  p_note text
)
returns public.school_inventory_items
language plpgsql security definer set search_path=''
as $$
declare
  item public.school_inventory_items%rowtype;
  after_qty integer;
  move_type text;
  uid uuid := (select auth.uid());
  result_row public.school_inventory_items%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_quantity_delta is null or p_quantity_delta=0 then
    raise exception 'Quantity change cannot be zero';
  end if;

  select * into item
  from public.school_inventory_items
  where id=p_item_id
  for update;

  if item.id is null then raise exception 'Inventory item not found'; end if;
  if item.item_type<>'Stock Item' then
    raise exception 'Only Stock Item quantity can be adjusted through this action';
  end if;

  if not exists(
    select 1 from public.institutions i
    where i.id=item.institution_id
      and i.owner_user_id=uid
  ) then
    raise exception 'Head access required';
  end if;

  after_qty:=item.quantity+p_quantity_delta;
  if after_qty<0 then raise exception 'Stock cannot go below zero'; end if;

  move_type:=case when p_quantity_delta>0 then 'IN' else 'OUT' end;

  update public.school_inventory_items
  set quantity=after_qty,
      updated_by=uid,
      updated_at=now()
  where id=item.id
  returning * into result_row;

  insert into public.school_inventory_movements(
    institution_id,item_id,movement_type,quantity_delta,
    before_quantity,after_quantity,note,created_by
  ) values(
    item.institution_id,item.id,move_type,p_quantity_delta,
    item.quantity,after_qty,nullif(trim(p_note),''),uid
  );

  return result_row;
end;
$$;

create or replace function private.assign_student_transport_v1(
  p_student_id uuid,
  p_route_id uuid,
  p_vehicle_id uuid,
  p_pickup_stop text,
  p_drop_stop text,
  p_effective_from date
)
returns public.student_transport_assignments
language plpgsql security definer set search_path=''
as $$
declare
  s public.core_students%rowtype;
  r public.transport_routes%rowtype;
  v public.transport_vehicles%rowtype;
  used integer;
  uid uuid := (select auth.uid());
  result_row public.student_transport_assignments%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into s from public.core_students where id=p_student_id;
  select * into r from public.transport_routes where id=p_route_id;
  select * into v from public.transport_vehicles where id=p_vehicle_id for update;

  if s.id is null or r.id is null or v.id is null then
    raise exception 'Student, route or vehicle not found';
  end if;

  if s.institution_id<>r.institution_id or s.institution_id<>v.institution_id then
    raise exception 'Transport records must belong to one institution';
  end if;

  if not exists(
    select 1 from public.institutions i
    where i.id=s.institution_id
      and i.owner_user_id=uid
  ) then
    raise exception 'Head access required';
  end if;

  if not r.active then raise exception 'Route is inactive'; end if;
  if v.status<>'active' then raise exception 'Vehicle is not active'; end if;

  select count(*) into used
  from public.student_transport_assignments a
  where a.vehicle_id=v.id
    and a.status='active'
    and a.student_id<>s.id;

  if used>=v.capacity then
    raise exception 'Vehicle capacity is full';
  end if;

  insert into public.student_transport_assignments(
    institution_id,student_id,route_id,vehicle_id,pickup_stop,drop_stop,
    effective_from,status,created_by
  ) values(
    s.institution_id,s.id,r.id,v.id,nullif(trim(p_pickup_stop),''),
    nullif(trim(p_drop_stop),''),coalesce(p_effective_from,current_date),
    'active',uid
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

revoke all on function private.adjust_inventory_stock_v1(uuid,integer,text) from public,anon;
revoke all on function private.assign_student_transport_v1(uuid,uuid,uuid,text,text,date) from public,anon;

grant execute on function private.adjust_inventory_stock_v1(uuid,integer,text) to authenticated;
grant execute on function private.assign_student_transport_v1(uuid,uuid,uuid,text,text,date) to authenticated;

create or replace function public.adjust_inventory_stock(
  p_item_id uuid,
  p_quantity_delta integer,
  p_note text default null
)
returns public.school_inventory_items
language sql security invoker set search_path=''
as $$
  select private.adjust_inventory_stock_v1(p_item_id,p_quantity_delta,p_note);
$$;

create or replace function public.assign_student_transport(
  p_student_id uuid,
  p_route_id uuid,
  p_vehicle_id uuid,
  p_pickup_stop text,
  p_drop_stop text,
  p_effective_from date
)
returns public.student_transport_assignments
language sql security invoker set search_path=''
as $$
  select private.assign_student_transport_v1(
    p_student_id,p_route_id,p_vehicle_id,p_pickup_stop,p_drop_stop,p_effective_from
  );
$$;

revoke all on function public.adjust_inventory_stock(uuid,integer,text) from public,anon;
revoke all on function public.assign_student_transport(uuid,uuid,uuid,text,text,date) from public,anon;

grant execute on function public.adjust_inventory_stock(uuid,integer,text) to authenticated;
grant execute on function public.assign_student_transport(uuid,uuid,uuid,text,text,date) to authenticated;
