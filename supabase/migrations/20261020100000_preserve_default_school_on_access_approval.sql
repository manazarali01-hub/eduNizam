-- Preserve a user's canonical/default school when another school approves same-role access.
-- Membership is added for the requested school; only fill institution_id when it is NULL.
-- This patch changes the first profile upsert assignment in each approval RPC, leaving
-- parent_student_links institution_id updates untouched.
begin;

do $migration$
declare
  definition text;
  patched text;
  target regprocedure;
  targets regprocedure[] := array[
    to_regprocedure('private.decide_school_access_request_v1(uuid,boolean,text)'),
    to_regprocedure('private.decide_teacher_school_request_v1(uuid,boolean,text)')
  ];
begin
  foreach target in array targets loop
    if target is null then
      raise exception 'Expected school-access approval RPC is missing; refusing partial migration';
    end if;

    definition := pg_get_functiondef(target);
    patched := regexp_replace(
      definition,
      'institution_id[[:space:]]*=[[:space:]]*excluded\.institution_id[[:space:]]*,',
      'institution_id=case when public.user_profiles.institution_id is null then excluded.institution_id else public.user_profiles.institution_id end,',
      ''
    );

    if patched = definition then
      raise exception 'Could not locate profile default-school assignment in %; refusing partial migration', target;
    end if;

    execute patched;
  end loop;
end;
$migration$;

commit;
