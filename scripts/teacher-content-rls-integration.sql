-- Executes the actual teacher-content migration against disposable PostgreSQL with RLS enabled.
-- JWT identity is set before each test statement so STABLE auth helpers see the intended user.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',false);
SELECT set_config('app.account_role','teacher',false);

DO $teacher$
DECLARE affected integer;
BEGIN
  IF NOT public.is_institution_staff('10000000-0000-0000-0000-000000000001')
    THEN RAISE EXCEPTION 'Fixture institution membership helper denied the seeded teacher'; END IF;

  UPDATE public.teacher_question_bank SET visibility='updated'
  WHERE id='50000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Authorized creator should update question; rows=%', affected; END IF;

  UPDATE public.teacher_papers SET visibility='updated'
  WHERE id='60000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Authorized creator should update paper; rows=%', affected; END IF;

  UPDATE public.teacher_question_bank SET visibility='cross-institution edit'
  WHERE id='50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Creator edited question after losing institution authorization'; END IF;

  UPDATE public.teacher_papers SET visibility='cross-institution edit'
  WHERE id='60000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Creator edited paper after losing institution authorization'; END IF;

  UPDATE public.teacher_question_bank SET visibility='other creator edit'
  WHERE id='50000000-0000-0000-0000-000000000003';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Creator edited another teacher question'; END IF;

  UPDATE public.teacher_papers SET visibility='other creator edit'
  WHERE id='60000000-0000-0000-0000-000000000003';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Creator edited another teacher paper'; END IF;

  BEGIN
    UPDATE public.teacher_question_bank SET institution_id='10000000-0000-0000-0000-000000000002'
    WHERE id='50000000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'Question moved into an unauthorized institution'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.teacher_papers SET institution_id='10000000-0000-0000-0000-000000000002'
    WHERE id='60000000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'Paper moved into an unauthorized institution'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  DELETE FROM public.teacher_question_bank WHERE id='50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Creator deleted question without institution authorization'; END IF;

  DELETE FROM public.teacher_papers WHERE id='60000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Creator deleted paper without institution authorization'; END IF;

  DELETE FROM public.teacher_question_bank WHERE id='50000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Authorized creator should delete question; rows=%', affected; END IF;

  DELETE FROM public.teacher_papers WHERE id='60000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Authorized creator should delete paper; rows=%', affected; END IF;
END
$teacher$;

RESET ROLE;
-- Simulate removal from the institution membership after the content was created.
DELETE FROM public.institution_members
WHERE institution_id='10000000-0000-0000-0000-000000000001'
  AND user_id='20000000-0000-0000-0000-000000000001';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',false);
SELECT set_config('app.account_role','teacher',false);
DO $former_staff$
DECLARE affected integer;
BEGIN
  UPDATE public.teacher_question_bank SET visibility='former staff edit'
  WHERE id='50000000-0000-0000-0000-000000000004';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Former staff updated a question after membership removal'; END IF;

  UPDATE public.teacher_papers SET visibility='former staff edit'
  WHERE id='60000000-0000-0000-0000-000000000004';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Former staff updated a paper after membership removal'; END IF;

  DELETE FROM public.teacher_question_bank WHERE id='50000000-0000-0000-0000-000000000004';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Former staff deleted a question after membership removal'; END IF;

  DELETE FROM public.teacher_papers WHERE id='60000000-0000-0000-0000-000000000004';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Former staff deleted a paper after membership removal'; END IF;
END
$former_staff$;
RESET ROLE;

DO $verify$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.teacher_question_bank WHERE id='50000000-0000-0000-0000-000000000003' AND visibility='teacher')
    THEN RAISE EXCEPTION 'Denied question write changed another creator row'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teacher_papers WHERE id='60000000-0000-0000-0000-000000000003' AND visibility='teacher')
    THEN RAISE EXCEPTION 'Denied paper write changed another creator row'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teacher_question_bank WHERE id='50000000-0000-0000-0000-000000000004' AND visibility='teacher')
    THEN RAISE EXCEPTION 'Former staff question row was modified or removed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teacher_papers WHERE id='60000000-0000-0000-0000-000000000004' AND visibility='teacher')
    THEN RAISE EXCEPTION 'Former staff paper row was modified or removed'; END IF;
  RAISE NOTICE 'Teacher content RLS integration PASS: creator + institution scope, WITH CHECK, DELETE and former-staff revocation verified.';
END
$verify$;
