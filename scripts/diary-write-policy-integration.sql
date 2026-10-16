-- Integration assertions for the actual diary migration, run only on disposable CI PostgreSQL.
-- Authenticated users execute statements under RLS; helper functions are isolated test doubles.
-- Set JWT/role GUCs in separate statements so STABLE helpers see the intended values.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',false);
SELECT set_config('app.account_role','teacher',false);

DO $teacher$
DECLARE affected integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM '20000000-0000-0000-0000-000000000001'::uuid
    THEN RAISE EXCEPTION 'Fixture auth.uid() did not read the simulated user'; END IF;
  IF public.current_account_role() IS DISTINCT FROM 'teacher'
    THEN RAISE EXCEPTION 'Fixture role helper did not read the simulated teacher role'; END IF;
  IF NOT public.is_institution_staff('10000000-0000-0000-0000-000000000001')
    THEN RAISE EXCEPTION 'Fixture institution membership helper denied the seeded teacher'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_sections cs
    WHERE cs.institution_id='10000000-0000-0000-0000-000000000001'
      AND cs.class_teacher_user_id=auth.uid()
      AND cs.class_name='Class 2' AND cs.section_name='A' AND cs.active=true
  ) THEN RAISE EXCEPTION 'Fixture class assignment is not visible to the simulated teacher'; END IF;

  UPDATE public.daily_class_diaries SET topic='Teacher A updated'
  WHERE id='50000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Assigned active class teacher should update own diary; rows=%', affected; END IF;

  -- USING authorizes the old row; WITH CHECK must reject moving it to another class.
  BEGIN
    UPDATE public.daily_class_diaries SET class_name='Class 3'
    WHERE id='50000000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'Teacher moved diary into an unassigned class'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  UPDATE public.daily_class_diaries SET topic='Unauthorized cross-class edit'
  WHERE id='50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Teacher edited a class assigned to another teacher; rows=%', affected; END IF;

  UPDATE public.daily_class_diaries SET topic='Inactive class edit'
  WHERE id='50000000-0000-0000-0000-000000000003';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Teacher edited an inactive class section; rows=%', affected; END IF;

  UPDATE public.daily_class_diaries SET topic='Other teacher edit'
  WHERE id='50000000-0000-0000-0000-000000000004';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Teacher edited another teacher diary; rows=%', affected; END IF;

  DELETE FROM public.daily_class_diaries
  WHERE id='50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Teacher deleted a diary for another teacher class; rows=%', affected; END IF;

  DELETE FROM public.daily_class_diaries
  WHERE id='50000000-0000-0000-0000-000000000003';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Teacher deleted a diary for an inactive class; rows=%', affected; END IF;

  DELETE FROM public.daily_class_diaries
  WHERE id='50000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Assigned active class teacher should delete own diary; rows=%', affected; END IF;
END
$teacher$;

SELECT set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',false);
SELECT set_config('app.account_role','head',false);

DO $head$
DECLARE affected integer;
BEGIN
  UPDATE public.daily_class_diaries SET topic='Head must not use teacher UPDATE policy'
  WHERE id='50000000-0000-0000-0000-000000000004';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Head unexpectedly matched teacher UPDATE policy; rows=%', affected; END IF;

  DELETE FROM public.daily_class_diaries
  WHERE id='50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Existing institution-owner DELETE policy was not preserved; rows=%', affected; END IF;
END
$head$;
RESET ROLE;

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.daily_class_diaries
    WHERE id='50000000-0000-0000-0000-000000000004'
      AND topic='Reading'
  ) THEN RAISE EXCEPTION 'Denied writes changed another teacher diary'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.daily_class_diaries
    WHERE id IN ('50000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002')
  ) THEN RAISE EXCEPTION 'Authorized teacher/owner delete did not take effect'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.daily_class_diaries
    WHERE id='50000000-0000-0000-0000-000000000003'
      AND topic='Plants'
  ) THEN RAISE EXCEPTION 'Denied inactive-section delete changed data'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.daily_class_diaries
    WHERE id='50000000-0000-0000-0000-000000000004'
  ) THEN RAISE EXCEPTION 'Other teacher diary unexpectedly disappeared'; END IF;
  RAISE NOTICE 'Diary RLS integration PASS: allowed active assignment; blocked cross-class, inactive, cross-teacher and head UPDATE; preserved owner DELETE.';
END
$verify$;
