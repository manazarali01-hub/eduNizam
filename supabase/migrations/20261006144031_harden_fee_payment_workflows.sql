drop index if exists public.fee_records_student_month_idx;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.fee_records'::regclass
      and conname='fee_records_institution_student_month_key'
  ) then
    alter table public.fee_records
      add constraint fee_records_institution_student_month_key
      unique (institution_id,student_id,fee_month);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.fee_records'::regclass
      and conname='fee_records_fee_month_format_check'
  ) then
    alter table public.fee_records
      add constraint fee_records_fee_month_format_check
      check (fee_month is null or fee_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.fee_records'::regclass
      and conname='fee_records_total_math_check'
  ) then
    alter table public.fee_records
      add constraint fee_records_total_math_check
      check (
        base_amount is null
        or amount = greatest(0::numeric, base_amount - discount + arrears)
      );
  end if;
end
$$;

create or replace function private.can_read_student_fee_v1(
  p_student_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select p_user_id is not null and exists(
    select 1
    from public.core_students s
    where s.id=p_student_id
      and (
        exists(
          select 1
          from public.institutions i
          where i.id=s.institution_id
            and i.owner_user_id=p_user_id
        )
        or s.auth_user_id=p_user_id
        or exists(
          select 1
          from public.parent_student_links l
          where l.institution_id=s.institution_id
            and l.parent_user_id=p_user_id
            and l.student_user_id=s.auth_user_id
            and l.status='approved'
        )
      )
  );
$function$;

revoke all on function private.can_read_student_fee_v1(uuid,uuid) from public, anon;
grant execute on function private.can_read_student_fee_v1(uuid,uuid) to authenticated;

drop policy if exists "institution users read class fees" on public.class_fee_structure;

drop policy if exists "users read accessible fees" on public.fee_records;
create policy "head student or parent reads fees"
on public.fee_records
for select
to authenticated
using (
  (select private.can_read_student_fee_v1(fee_records.student_id,(select auth.uid())))
);

drop policy if exists "users read accessible fee payments" on public.fee_payments;
create policy "head student or parent reads fee payments"
on public.fee_payments
for select
to authenticated
using (
  (select private.can_read_student_fee_v1(fee_payments.student_id,(select auth.uid())))
);

revoke all privileges on table
  public.class_fee_structure,
  public.fee_records,
  public.fee_payments,
  public.payment_records
from anon;

create or replace function private.notify_fee_payment_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  f public.fee_records%rowtype;
  s public.core_students%rowtype;
  remaining numeric;
begin
  select * into f
  from public.fee_records
  where id=new.fee_record_id;

  select * into s
  from public.core_students
  where id=new.student_id;

  remaining := greatest(coalesce(f.amount,0)-coalesce(f.paid_amount,0)-new.amount,0);

  insert into public.user_notifications(
    institution_id,recipient_user_id,created_by,category,title,body
  )
  select
    new.institution_id,
    r.recipient_user_id,
    new.recorded_by,
    'fee',
    'Fee payment received',
    left(
      coalesce(nullif(f.fee_month,''),'Fee')||
      ' · Received PKR '||new.amount::text||
      ' · Balance PKR '||remaining::text||
      ' · Receipt '||new.receipt_no,
      180
    )
  from (
    select s.auth_user_id as recipient_user_id
    where s.auth_user_id is not null
    union
    select l.parent_user_id
    from public.parent_student_links l
    where l.institution_id=new.institution_id
      and l.student_user_id=s.auth_user_id
      and l.status='approved'
  ) r
  where r.recipient_user_id is not null
    and r.recipient_user_id<>new.recorded_by;

  return new;
end;
$function$;

revoke all on function private.notify_fee_payment_v1() from public, anon, authenticated;

drop trigger if exists notify_fee_payment_v1 on public.fee_payments;
create trigger notify_fee_payment_v1
after insert on public.fee_payments
for each row
execute function private.notify_fee_payment_v1();
