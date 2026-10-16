-- Isolated PostgreSQL fixture for exercising the real diary migration under RLS.
-- Runs only in the disposable GitHub Actions postgres service, never against production.
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;

CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE public.institutions (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL
);
CREATE TABLE public.institution_members (
  institution_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL
);
CREATE TABLE public.class_sections (
  id uuid PRIMARY KEY,
  institution_id uuid NOT NULL,
  class_name text NOT NULL,
  section_name text NOT NULL,
  class_teacher_user_id uuid,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.daily_class_diaries (
  id uuid PRIMARY KEY,
  institution_id uuid NOT NULL,
  teacher_user_id uuid NOT NULL,
  diary_date date NOT NULL,
  class_name text NOT NULL,
  section_name text NOT NULL,
  subject text NOT NULL,
  topic text NOT NULL,
  homework text NOT NULL,
  instructions text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION public.current_account_role() RETURNS text
LANGUAGE sql STABLE
AS $$ SELECT current_setting('app.account_role', true) $$;

CREATE FUNCTION public.is_institution_staff(p_institution_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.institutions i
    WHERE i.id = p_institution_id AND i.owner_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.institution_members m
    WHERE m.institution_id = p_institution_id
      AND m.user_id = auth.uid()
      AND m.role = 'teacher'
  )
$$;
GRANT EXECUTE ON FUNCTION public.current_account_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_institution_staff(uuid) TO authenticated;

ALTER TABLE public.class_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fixture institution class read" ON public.class_sections
  FOR SELECT TO authenticated USING (public.is_institution_staff(institution_id));
ALTER TABLE public.daily_class_diaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fixture institution diary read" ON public.daily_class_diaries
  FOR SELECT TO authenticated USING (public.is_institution_staff(institution_id));

-- Simulate the existing INSERT policy before the migration; it lacks active-state validation.
CREATE POLICY "assigned teachers write diaries" ON public.daily_class_diaries
  FOR INSERT TO authenticated WITH CHECK (
    teacher_user_id = (SELECT auth.uid())
    AND public.current_account_role() = 'teacher'
    AND EXISTS (
      SELECT 1 FROM public.class_sections cs
      WHERE cs.institution_id = daily_class_diaries.institution_id
        AND cs.class_teacher_user_id = (SELECT auth.uid())
        AND cs.class_name = daily_class_diaries.class_name
        AND COALESCE(cs.section_name, '') = COALESCE(daily_class_diaries.section_name, '')
    )
  );

-- Existing owner-delete rule must survive the teacher-policy migration.
CREATE POLICY "heads delete institute diaries" ON public.daily_class_diaries
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.institutions i
    WHERE i.id = daily_class_diaries.institution_id
      AND i.owner_user_id = auth.uid()
  ));

GRANT SELECT ON public.institutions TO authenticated;
GRANT SELECT ON public.class_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_class_diaries TO authenticated;

INSERT INTO public.institutions VALUES
 ('10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001');
INSERT INTO public.institution_members VALUES
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','teacher'),
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','teacher');

INSERT INTO public.class_sections VALUES
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Class 2','A','20000000-0000-0000-0000-000000000001',true),
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Class 3','A','30000000-0000-0000-0000-000000000001',true),
 ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Class 4','B','20000000-0000-0000-0000-000000000001',false);

INSERT INTO public.daily_class_diaries
 (id,institution_id,teacher_user_id,diary_date,class_name,section_name,subject,topic,homework,instructions)
VALUES
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-10-16','Class 2','A','Math','Fractions','',''),
 ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-10-16','Class 3','A','Math','Decimals','',''),
 ('50000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-10-16','Class 4','B','Science','Plants','',''),
 ('50000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2026-10-16','Class 3','A','English','Reading','','');
