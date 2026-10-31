-- Performance hardening: add the final covering FK indexes reported by Supabase
-- and avoid per-row auth.uid() evaluation in the inventory movement admin policy.

create index if not exists idx_parent_admin_complaint_attachments_uploaded_by
  on public.parent_admin_complaint_attachments(uploaded_by);

create index if not exists idx_parent_admin_complaints_resolved_by
  on public.parent_admin_complaints(resolved_by);

create index if not exists idx_school_inventory_movements_created_by
  on public.school_inventory_movements(created_by);

create index if not exists idx_school_inventory_movements_item_id
  on public.school_inventory_movements(item_id);

drop policy if exists "heads manage school inventory movements"
  on public.school_inventory_movements;

create policy "heads manage school inventory movements"
on public.school_inventory_movements
as permissive
for all
to authenticated
using (
  exists (
    select 1
    from public.institutions i
    where i.id = school_inventory_movements.institution_id
      and i.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.institutions i
    where i.id = school_inventory_movements.institution_id
      and i.owner_user_id = (select auth.uid())
  )
);
