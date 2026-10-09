-- Applied to connected Supabase project as migration 20261009141035.
-- School-entered textbook provenance for syllabus units, not automatic
-- certification of edition, board approval, or question authenticity.
-- Additive columns preserve older syllabus rows and existing RLS.
alter table public.syllabus_progress_units
  add column if not exists textbook_title text,
  add column if not exists curriculum_board text,
  add column if not exists edition_year integer,
  add column if not exists source_url text;

comment on column public.syllabus_progress_units.textbook_title is 'School-entered prescribed textbook title, not independent curriculum certification';
comment on column public.syllabus_progress_units.curriculum_board is 'School-reported textbook board; not independent verification';
comment on column public.syllabus_progress_units.edition_year is 'School-entered edition year if known';
comment on column public.syllabus_progress_units.source_url is 'Optional HTTPS publisher or official textbook listing link';
