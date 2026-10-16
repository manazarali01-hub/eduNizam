-- Integration assertions for the actual diary migration, run only on disposable CI PostgreSQL.
-- Authenticated users execute statements under RLS; helper functions are isolated test doubles.
SET ROLE authenticated;
DO $test$
DECLARE affected integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
  PERFORM set_config('app.account_role','teacher',true);

  UPDATE public.daily_class_diaries SET topic='Teacher A updated'
  WHERE id='50000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Assigned active class teacher should update own diary; rows=%', affected; END IF;

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

  PERFORM set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
  PERFORM set_config('app.account_role','head',true);

  UPDATE public.daily_class_diaries SET topic='Head must not use teacher UPDATE policy'
  WHERE id='50000000-0000-0000-0000-000000000004';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Head unexpectedly matched teacher UPDATE policy; rows=%', affected; END IF;

  DELETE FROM public.daily_class_diaries
  WHERE id='50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Existing institution-owner DELETE policy was not preserved; rows=%', affected; END IF;
END
$test$;
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
