create or replace function public.enforce_teacher_profile_membership()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.account_role = 'teacher' then
    if new.institution_id is null or not exists (
      select 1
      from public.institution_members m
      where m.institution_id = new.institution_id
        and m.user_id = new.user_id
        and m.role = 'teacher'
    ) then
      raise exception 'Teacher role requires approved staff membership';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_teacher_profile_membership() from public, anon, authenticated;

drop trigger if exists enforce_teacher_profile_membership_trigger on public.user_profiles;

create trigger enforce_teacher_profile_membership_trigger
before insert or update on public.user_profiles
for each row
execute function public.enforce_teacher_profile_membership();
