-- End-to-end assertions against the actual invite-claim migration on disposable PostgreSQL.
SET ROLE authenticated;

DO $tests$
DECLARE err text; result_role text;
BEGIN
  -- Existing Head must not be converted into a student; rejected claims do not consume invites.
  PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',false);
  BEGIN
    PERFORM 1 FROM public.claim_institution_invite('HEAD-STUDENT');
    RAISE EXCEPTION 'TEST_SENTINEL: head role reassignment unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    IF err='TEST_SENTINEL: head role reassignment unexpectedly succeeded' THEN RAISE; END IF;
    IF err NOT LIKE '%different school or role%' THEN RAISE EXCEPTION 'Unexpected Head rejection: %',err; END IF;
  END;
  IF (SELECT account_role FROM public.user_profiles WHERE user_id=auth.uid()) <> 'head_of_institute'
    OR (SELECT institution_id FROM public.user_profiles WHERE user_id=auth.uid()) <> '10000000-0000-0000-0000-000000000001'::uuid
    OR (SELECT use_count FROM public.institution_invites WHERE code='HEAD-STUDENT') <> 0
    THEN RAISE EXCEPTION 'Head profile or invite changed after rejected claim'; END IF;

  -- Existing Teacher cannot claim a parent invite.
  PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',false);
  BEGIN
    PERFORM 1 FROM public.claim_institution_invite('TEACHER-PARENT');
    RAISE EXCEPTION 'TEST_SENTINEL: teacher role reassignment unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    IF err='TEST_SENTINEL: teacher role reassignment unexpectedly succeeded' THEN RAISE; END IF;
    IF err NOT LIKE '%different school or role%' THEN RAISE EXCEPTION 'Unexpected Teacher rejection: %',err; END IF;
  END;
  IF (SELECT account_role FROM public.user_profiles WHERE user_id=auth.uid()) <> 'teacher'
    OR (SELECT use_count FROM public.institution_invites WHERE code='TEACHER-PARENT') <> 0
    THEN RAISE EXCEPTION 'Teacher profile or invite changed after rejected claim'; END IF;

  -- Same-role student may join a second school; the existing default school stays unchanged.
  PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',false);
  SELECT granted_role INTO result_role FROM public.claim_institution_invite('STUDENT-SECOND');
  IF result_role <> 'student'
    OR (SELECT account_role FROM public.user_profiles WHERE user_id=auth.uid()) <> 'student'
    OR (SELECT institution_id FROM public.user_profiles WHERE user_id=auth.uid()) <> '10000000-0000-0000-0000-000000000001'::uuid
    OR NOT EXISTS (SELECT 1 FROM public.institution_members WHERE user_id=auth.uid() AND institution_id='10000000-0000-0000-0000-000000000002'::uuid AND role='student')
    OR (SELECT use_count FROM public.institution_invites WHERE code='STUDENT-SECOND') <> 1
    THEN RAISE EXCEPTION 'Same-role student multi-school claim failed or changed default school'; END IF;

  -- Same-role parent may also join another school without replacing the profile's default school.
  PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',false);
  SELECT granted_role INTO result_role FROM public.claim_institution_invite('PARENT-SECOND');
  IF result_role <> 'parent'
    OR (SELECT institution_id FROM public.user_profiles WHERE user_id=auth.uid()) <> '10000000-0000-0000-0000-000000000001'::uuid
    OR NOT EXISTS (SELECT 1 FROM public.institution_members WHERE user_id=auth.uid() AND institution_id='10000000-0000-0000-0000-000000000002'::uuid AND role='parent')
    THEN RAISE EXCEPTION 'Same-role parent multi-school claim failed or changed default school'; END IF;

  -- Existing student cannot become a parent; invitation remains unused.
  PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',false);
  BEGIN
    PERFORM 1 FROM public.claim_institution_invite('STUDENT-PARENT');
    RAISE EXCEPTION 'TEST_SENTINEL: student-to-parent reassignment unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    IF err='TEST_SENTINEL: student-to-parent reassignment unexpectedly succeeded' THEN RAISE; END IF;
    IF err NOT LIKE '%different school or role%' THEN RAISE EXCEPTION 'Unexpected Student-to-Parent rejection: %',err; END IF;
  END;
  IF (SELECT use_count FROM public.institution_invites WHERE code='STUDENT-PARENT') <> 0
    THEN RAISE EXCEPTION 'Conflicting-role invite was consumed'; END IF;

  -- New account receives the invited role and school membership.
  PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',false);
  SELECT granted_role INTO result_role FROM public.claim_institution_invite('NEW-STUDENT');
  IF result_role <> 'student'
    OR NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id=auth.uid() AND account_role='student' AND institution_id='10000000-0000-0000-0000-000000000002'::uuid)
    OR NOT EXISTS (SELECT 1 FROM public.institution_members WHERE user_id=auth.uid() AND institution_id='10000000-0000-0000-0000-000000000002'::uuid AND role='student')
    THEN RAISE EXCEPTION 'New student invite claim did not create the correct profile and membership'; END IF;

  -- Unauthenticated and invalid/expired codes remain rejected.
  PERFORM set_config('request.jwt.claim.sub','',false);
  BEGIN
    PERFORM 1 FROM public.claim_institution_invite('NEW-STUDENT');
    RAISE EXCEPTION 'TEST_SENTINEL: unauthenticated claim unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    IF err='TEST_SENTINEL: unauthenticated claim unexpectedly succeeded' THEN RAISE; END IF;
    IF err NOT LIKE '%Authentication required%' THEN RAISE EXCEPTION 'Unexpected unauthenticated rejection: %',err; END IF;
  END;
END;
$tests$;

RESET ROLE;
