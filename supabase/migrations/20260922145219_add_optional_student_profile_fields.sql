-- Keep optional student profile fields aligned with app.js/core-cloud.js.
-- Only student name remains required in the UI; these database fields are nullable.

alter table public.core_students
  add column if not exists section_name text,
  add column if not exists b_form_no text,
  add column if not exists guardian_cnic text,
  add column if not exists date_of_birth date,
  add column if not exists admission_no text,
  add column if not exists address text,
  add column if not exists guardian_occupation text,
  add column if not exists caste text;

