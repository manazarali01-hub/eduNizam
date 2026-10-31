-- Protect active teacher questions against duplicate writes racing between sessions.
-- Keep school and creator isolation. Inactive questions do not block re-import.
-- Text normalization ignores surrounding/repeated whitespace and letter case.
CREATE UNIQUE INDEX IF NOT EXISTS teacher_question_bank_owner_question_unique_active
ON public.teacher_question_bank (
 institution_id,
 creator_user_id,
 (lower(regexp_replace(btrim(class_name), '[[:space:]]+', ' ', 'g'))),
 (lower(regexp_replace(btrim(subject), '[[:space:]]+', ' ', 'g'))),
 (lower(regexp_replace(btrim(coalesce(chapter, '')), '[[:space:]]+', ' ', 'g'))),
 (lower(regexp_replace(btrim(question_type), '[[:space:]]+', ' ', 'g'))),
 (lower(regexp_replace(btrim(question_text), '[[:space:]]+', ' ', 'g')))
)
WHERE active IS TRUE;
