-- Applied in Supabase migration history: restrict_admin_settings_and_profile_management

drop policy if exists "staff manage institution settings" on public.institution_settings;
drop policy if exists "heads manage institution settings" on public.institution_settings;
create policy "heads manage institution settings"
on public.institution_settings for all to authenticated
using ((select private.is_institution_owner(institution_id,(select auth.uid()))))
with check ((select private.is_institution_owner(institution_id,(select auth.uid()))));

drop policy if exists "staff manage institution profiles" on public.user_profiles;
drop policy if exists "heads manage institution profiles" on public.user_profiles;
drop policy if exists "users update own profile" on public.user_profiles;

create policy "heads manage institution profiles"
on public.user_profiles for all to authenticated
using (
  institution_id is not null
  and (select private.is_institution_owner(institution_id,(select auth.uid())))
)
with check (
  institution_id is not null
  and (select private.is_institution_owner(institution_id,(select auth.uid())))
);

create policy "users update own profile"
on public.user_profiles for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

revoke insert,delete,truncate,references,trigger on table public.user_profiles from authenticated;
revoke update on table public.user_profiles from authenticated;
grant select on table public.user_profiles to authenticated;
grant update(full_name,phone,updated_at) on table public.user_profiles to authenticated;
