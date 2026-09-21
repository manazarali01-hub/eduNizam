-- EduNizam security hardening: internal trigger functions must not be callable
-- directly by anonymous or signed-in API users.

begin;

revoke execute on function public.assign_default_subscription()
  from public, anon, authenticated;
revoke execute on function public.handle_new_user_profile()
  from public, anon, authenticated;

grant execute on function public.assign_default_subscription()
  to service_role;
grant execute on function public.handle_new_user_profile()
  to service_role;

commit;
