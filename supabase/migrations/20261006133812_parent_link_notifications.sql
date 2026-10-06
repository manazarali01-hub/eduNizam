create or replace function private.notify_parent_student_link_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  uid uuid := (select auth.uid());
  owner_id uuid;
  student_name text;
  parent_name text;
  changed boolean := tg_op='INSERT' or old.status is distinct from new.status;
begin
  if uid is null or not changed then
    return new;
  end if;

  select i.owner_user_id
    into owner_id
  from public.institutions i
  where i.id=new.institution_id;

  select s.name
    into student_name
  from public.core_students s
  where s.institution_id=new.institution_id
    and s.auth_user_id=new.student_user_id
  limit 1;

  select coalesce(nullif(p.full_name,''),'Parent / Guardian')
    into parent_name
  from public.user_profiles p
  where p.user_id=new.parent_user_id
  limit 1;

  student_name := coalesce(nullif(student_name,''),'Student');
  parent_name := coalesce(nullif(parent_name,''),'Parent / Guardian');

  if new.status='pending' then
    if owner_id is not null and owner_id<>uid then
      insert into public.user_notifications(
        institution_id,recipient_user_id,created_by,category,title,body
      ) values(
        new.institution_id,owner_id,uid,'access',
        'Parent-child link request',
        parent_name||' requested access to '||student_name||'. Review the Parent-Student link request.'
      );
    end if;
  elsif new.status in ('approved','rejected') then
    if new.parent_user_id is not null and new.parent_user_id<>uid then
      insert into public.user_notifications(
        institution_id,recipient_user_id,created_by,category,title,body
      ) values(
        new.institution_id,new.parent_user_id,uid,'access',
        case when new.status='approved' then 'Parent-child link approved' else 'Parent-child link rejected' end,
        case when new.status='approved'
          then 'Your access to '||student_name||' has been approved. Linked school features and messaging are now available.'
          else 'Your request to access '||student_name||' was rejected by the School Admin.'
        end
      );
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.notify_parent_student_link_v1() from public, anon, authenticated;

drop trigger if exists notify_parent_student_link_v1 on public.parent_student_links;
create trigger notify_parent_student_link_v1
after insert or update of status on public.parent_student_links
for each row
execute function private.notify_parent_student_link_v1();
