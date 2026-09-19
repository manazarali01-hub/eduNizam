-- EduNizam School Finance & Cashbook upgrade migration
-- =========================================================
-- EduNizam School Finance & Cashbook
-- =========================================================
begin;

create table if not exists public.school_finance_entries (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  entry_type text not null check (entry_type in ('Income','Expense')),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  entry_date date not null,
  reference text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists school_finance_entries_institution_date_idx
on public.school_finance_entries(institution_id,entry_date desc);

alter table public.school_finance_entries enable row level security;

drop policy if exists "heads manage school finance entries" on public.school_finance_entries;
create policy "heads manage school finance entries" on public.school_finance_entries
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=school_finance_entries.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=school_finance_entries.institution_id and i.owner_user_id=auth.uid())
);

commit;


