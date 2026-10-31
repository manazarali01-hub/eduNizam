-- EduNizam Smart Paper Builder — reusable teacher question bank
-- Apply after the core teacher_papers schema.

begin;

drop policy if exists "teachers create own papers" on public.teacher_papers;
drop policy if exists "teachers and heads create own papers" on public.teacher_papers;
create policy "teachers and heads create own papers"
on public.teacher_papers
for insert to authenticated
with check (
  creator_user_id=(select auth.uid())
  and (
    (public.current_account_role()='teacher' and public.is_institution_staff(institution_id))
    or exists(
      select 1 from public.institutions i
      where i.id=teacher_papers.institution_id
        and i.owner_user_id=(select auth.uid())
    )
  )
);

create table if not exists public.teacher_question_bank (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  class_name text not null,
  subject text not null,
  chapter text,
  question_type text not null check (question_type in ('mcq','short','long')),
  difficulty text not null default 'Balanced' check (difficulty in ('Easy','Balanced','Challenging')),
  question_text text not null,
  options jsonb not null default '[]'::jsonb,
  correct_option integer,
  answer_text text,
  visibility text not null default 'private' check (visibility in ('private','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(question_text)) >= 3),
  check (char_length(coalesce(answer_text,'')) <= 10000),
  check (
    question_type <> 'mcq'
    or (
      jsonb_typeof(options)='array'
      and jsonb_array_length(options)>=2
      and correct_option is not null
      and correct_option>=0
      and correct_option<jsonb_array_length(options)
    )
  )
);

create index if not exists teacher_question_bank_creator_idx
  on public.teacher_question_bank(institution_id,creator_user_id,active);
create index if not exists teacher_question_bank_filter_idx
  on public.teacher_question_bank(institution_id,class_name,subject,question_type,difficulty)
  where active=true;

alter table public.teacher_question_bank enable row level security;

drop policy if exists "question creator and admin read" on public.teacher_question_bank;
create policy "question creator and admin read"
on public.teacher_question_bank
for select to authenticated
using (
  creator_user_id=(select auth.uid())
  or (
    visibility='admin'
    and exists(
      select 1 from public.institutions i
      where i.id=teacher_question_bank.institution_id
        and i.owner_user_id=(select auth.uid())
    )
  )
);

drop policy if exists "teachers and heads create own questions" on public.teacher_question_bank;
create policy "teachers and heads create own questions"
on public.teacher_question_bank
for insert to authenticated
with check (
  creator_user_id=(select auth.uid())
  and (
    (public.current_account_role()='teacher' and public.is_institution_staff(institution_id))
    or exists(
      select 1 from public.institutions i
      where i.id=teacher_question_bank.institution_id
        and i.owner_user_id=(select auth.uid())
    )
  )
);

drop policy if exists "question creator updates" on public.teacher_question_bank;
create policy "question creator updates"
on public.teacher_question_bank
for update to authenticated
using (creator_user_id=(select auth.uid()))
with check (creator_user_id=(select auth.uid()));

drop policy if exists "question creator deletes" on public.teacher_question_bank;
create policy "question creator deletes"
on public.teacher_question_bank
for delete to authenticated
using (creator_user_id=(select auth.uid()));

revoke all on public.teacher_question_bank from anon;
grant select,insert,update,delete on public.teacher_question_bank to authenticated;

commit;
