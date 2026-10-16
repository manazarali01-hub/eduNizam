-- Isolated PostgreSQL fixture for the teacher content migration. Never connects to production.
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE public.institutions (id uuid PRIMARY KEY, owner_user_id uuid NOT NULL);
CREATE TABLE public.institution_members (institution_id uuid NOT NULL, user_id uuid NOT NULL, role text NOT NULL);
CREATE TABLE public.teacher_question_bank (
  id uuid PRIMARY KEY, institution_id uuid, creator_user_id uuid, visibility text NOT NULL DEFAULT 'teacher'
);
CREATE TABLE public.teacher_papers (
  id uuid PRIMARY KEY, institution_id uuid, creator_user_id uuid, visibility text NOT NULL DEFAULT 'teacher'
);
CREATE FUNCTION public.current_account_role() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT current_setting('app.account_role', true) $$;
CREATE FUNCTION public.is_institution_staff(p_institution_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT EXISTS (SELECT 1 FROM public.institutions i
   WHERE i.id=p_institution_id AND i.owner_user_id=auth.uid())
 OR EXISTS (SELECT 1 FROM public.institution_members m
   WHERE m.institution_id=p_institution_id AND m.user_id=auth.uid() AND m.role='teacher')
$$;
GRANT EXECUTE ON FUNCTION public.current_account_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_institution_staff(uuid) TO authenticated;

ALTER TABLE public.teacher_question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_papers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE, DELETE ON public.teacher_question_bank TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.teacher_papers TO authenticated;

INSERT INTO public.institutions VALUES
 ('10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002');
INSERT INTO public.institution_members VALUES
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','teacher'),
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','teacher');

INSERT INTO public.teacher_question_bank VALUES
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','teacher'),
 ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','teacher'),
 ('50000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','teacher'),
 ('50000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','teacher');
INSERT INTO public.teacher_papers VALUES
 ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','teacher'),
 ('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','teacher'),
 ('60000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','teacher'),
 ('60000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','teacher');
