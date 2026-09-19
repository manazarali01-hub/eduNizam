-- EduNizam Monthly Fee Challan & Receipt Center upgrade migration
-- =========================================================
-- EduNizam Monthly Fee Challans & Receipts
-- =========================================================
begin;

alter table public.fee_records add column if not exists fee_month text;
alter table public.fee_records add column if not exists base_amount numeric(12,2);
alter table public.fee_records add column if not exists discount numeric(12,2) not null default 0;
alter table public.fee_records add column if not exists arrears numeric(12,2) not null default 0;
alter table public.fee_records add column if not exists due_date date;
alter table public.fee_records add column if not exists challan_no text;
alter table public.fee_records add column if not exists receipt_no text;
alter table public.fee_records add column if not exists payment_reference text;
alter table public.fee_records add column if not exists paid_at timestamptz;

create unique index if not exists fee_records_student_month_idx
on public.fee_records(institution_id,student_id,fee_month)
where fee_month is not null;

create unique index if not exists fee_records_challan_no_idx
on public.fee_records(challan_no)
where challan_no is not null;

create unique index if not exists fee_records_receipt_no_idx
on public.fee_records(receipt_no)
where receipt_no is not null;

create table if not exists public.class_fee_structure (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  class_name text not null,
  monthly_fee numeric(12,2) not null default 0 check (monthly_fee >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (institution_id,class_name)
);

alter table public.class_fee_structure enable row level security;

drop policy if exists "institution users read class fees" on public.class_fee_structure;
create policy "institution users read class fees" on public.class_fee_structure
for select to authenticated
using (public.is_institution_user(institution_id));

drop policy if exists "heads manage class fees" on public.class_fee_structure;
create policy "heads manage class fees" on public.class_fee_structure
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=class_fee_structure.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=class_fee_structure.institution_id and i.owner_user_id=auth.uid())
);

commit;


