-- Harden fee and result integrity at the database boundary.
-- Existing production rows were checked before this migration: no invalid rows found.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.result_records'::regclass
      and conname='result_records_marks_bounds_check'
  ) then
    alter table public.result_records
      add constraint result_records_marks_bounds_check
      check (total > 0 and marks >= 0 and marks <= total);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.result_records'::regclass
      and conname='result_records_subject_nonempty_check'
  ) then
    alter table public.result_records
      add constraint result_records_subject_nonempty_check
      check (nullif(btrim(subject),'') is not null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.fee_records'::regclass
      and conname='fee_records_amount_nonnegative_check'
  ) then
    alter table public.fee_records
      add constraint fee_records_amount_nonnegative_check
      check (amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.fee_records'::regclass
      and conname='fee_records_base_amount_nonnegative_check'
  ) then
    alter table public.fee_records
      add constraint fee_records_base_amount_nonnegative_check
      check (base_amount is null or base_amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.fee_records'::regclass
      and conname='fee_records_discount_nonnegative_check'
  ) then
    alter table public.fee_records
      add constraint fee_records_discount_nonnegative_check
      check (discount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.fee_records'::regclass
      and conname='fee_records_arrears_nonnegative_check'
  ) then
    alter table public.fee_records
      add constraint fee_records_arrears_nonnegative_check
      check (arrears >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.fee_records'::regclass
      and conname='fee_records_status_check'
  ) then
    alter table public.fee_records
      add constraint fee_records_status_check
      check (status in ('Pending','Partially Paid','Paid'));
  end if;
end
$$;
