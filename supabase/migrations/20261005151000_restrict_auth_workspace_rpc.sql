-- Private school workspace discovery must only be callable by authenticated sessions.
revoke execute on function public.my_authorized_workspaces() from anon;
revoke execute on function public.my_authorized_workspaces() from public;
grant execute on function public.my_authorized_workspaces() to authenticated;
