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




-- Deep partial-payment ledger

alter table public.fee_records
  add column if not exists paid_amount numeric not null default 0;

update public.fee_records
set paid_amount=amount
where status='Paid'
  and coalesce(paid_amount,0)=0
  and amount>=0;

update public.fee_records
set status='Partially Paid'
where coalesce(paid_amount,0)>0
  and coalesce(paid_amount,0)<amount
  and status<>'Paid';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='fee_records_paid_amount_check'
      and conrelid='public.fee_records'::regclass
  ) then
    alter table public.fee_records
      add constraint fee_records_paid_amount_check
      check (paid_amount >= 0 and paid_amount <= amount);
  end if;
end $$;

create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  fee_record_id uuid not null references public.fee_records(id) on delete cascade,
  student_id uuid not null references public.core_students(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payment_reference text,
  receipt_no text not null,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(institution_id,receipt_no)
);

create index if not exists fee_payments_fee_record_idx on public.fee_payments(fee_record_id,paid_at desc);
create index if not exists fee_payments_student_idx on public.fee_payments(student_id,paid_at desc);
create index if not exists fee_payments_recorded_by_idx on public.fee_payments(recorded_by,paid_at desc);
create index if not exists fee_payments_institution_idx on public.fee_payments(institution_id,paid_at desc);

alter table public.fee_payments enable row level security;

drop policy if exists "users read accessible fee payments" on public.fee_payments;
create policy "users read accessible fee payments" on public.fee_payments
for select to authenticated
using (public.can_access_core_student(student_id));

drop policy if exists "heads record fee payments" on public.fee_payments;
create policy "heads record fee payments" on public.fee_payments
for insert to authenticated
with check (
  recorded_by=(select auth.uid())
  and exists(
    select 1 from public.institutions i
    where i.id=fee_payments.institution_id and i.owner_user_id=(select auth.uid())
  )
  and exists(
    select 1 from public.fee_records f
    where f.id=fee_payments.fee_record_id
      and f.institution_id=fee_payments.institution_id
      and f.student_id=fee_payments.student_id
  )
);

revoke all on public.fee_payments from anon;
revoke update,delete,truncate,references,trigger on public.fee_payments from authenticated;
grant select,insert on public.fee_payments to authenticated;
