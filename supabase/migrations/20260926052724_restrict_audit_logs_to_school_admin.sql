-- Applied in Supabase migration history: restrict_audit_logs_to_school_admin
drop policy if exists "authenticated insert audit logs" on public.audit_logs;
drop policy if exists "staff read audit logs" on public.audit_logs;
drop policy if exists "heads insert audit logs" on public.audit_logs;
drop policy if exists "heads read audit logs" on public.audit_logs;

create policy "heads insert audit logs"
on public.audit_logs for insert to authenticated
with check (
  user_id=(select auth.uid())
  and (select private.is_institution_owner(institution_id,(select auth.uid())))
);

create policy "heads read audit logs"
on public.audit_logs for select to authenticated
using ((select private.is_institution_owner(institution_id,(select auth.uid()))));
