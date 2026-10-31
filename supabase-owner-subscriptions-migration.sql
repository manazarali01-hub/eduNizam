-- EduNizam SaaS Owner & Subscription Center upgrade migration
-- =========================================================
-- EduNizam SaaS Owner & Subscription Management
-- =========================================================
begin;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select auth.uid() is not null
    and exists(select 1 from public.platform_admins p where p.user_id=auth.uid());
$$;

grant execute on function public.is_platform_admin() to authenticated;

drop policy if exists "platform admins read admin list" on public.platform_admins;
create policy "platform admins read admin list" on public.platform_admins
for select to authenticated
using (public.is_platform_admin());

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  monthly_price_pkr numeric(12,2) not null default 0 check (monthly_price_pkr >= 0),
  trial_days integer not null default 0 check (trial_days >= 0),
  max_students integer check (max_students is null or max_students > 0),
  max_staff integer check (max_staff is null or max_staff > 0),
  ai_daily_limit integer check (ai_daily_limit is null or ai_daily_limit >= 0),
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;

drop policy if exists "authenticated read subscription plans" on public.subscription_plans;
create policy "authenticated read subscription plans" on public.subscription_plans
for select to authenticated using (true);

drop policy if exists "platform admins manage subscription plans" on public.subscription_plans;
create policy "platform admins manage subscription plans" on public.subscription_plans
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

insert into public.subscription_plans(code,name,monthly_price_pkr,trial_days,features,active)
values('free','Free',0,0,'[]'::jsonb,true)
on conflict (code) do nothing;

create table if not exists public.institution_subscriptions (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'active'
    check (status in ('trialing','active','past_due','suspended','cancelled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.institution_subscriptions enable row level security;

drop policy if exists "platform admins manage institution subscriptions" on public.institution_subscriptions;
create policy "platform admins manage institution subscriptions" on public.institution_subscriptions
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "heads read own subscription" on public.institution_subscriptions;
create policy "heads read own subscription" on public.institution_subscriptions
for select to authenticated
using (
  exists(
    select 1 from public.institutions i
    where i.id=institution_subscriptions.institution_id
      and i.owner_user_id=auth.uid()
  )
);

create or replace function public.assign_default_subscription()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  free_plan uuid;
begin
  select id into free_plan from public.subscription_plans where code='free' limit 1;
  if free_plan is not null then
    insert into public.institution_subscriptions(institution_id,plan_id,status)
    values(new.id,free_plan,'active')
    on conflict (institution_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_default_subscription on public.institutions;
create trigger trg_assign_default_subscription
after insert on public.institutions
for each row execute function public.assign_default_subscription();

insert into public.institution_subscriptions(institution_id,plan_id,status)
select i.id,p.id,'active'
from public.institutions i
cross join public.subscription_plans p
where p.code='free'
  and not exists(
    select 1 from public.institution_subscriptions s where s.institution_id=i.id
  )
on conflict (institution_id) do nothing;

create or replace function public.platform_owner_institutions()
returns table(
  institution_id uuid,
  institution_name text,
  institution_type text,
  institution_created_at timestamptz,
  student_count bigint,
  staff_count bigint,
  plan_id uuid,
  plan_code text,
  plan_name text,
  monthly_price_pkr numeric,
  subscription_status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform administrator access required';
  end if;

  return query
  select
    i.id,
    i.name,
    i.institution_type,
    i.created_at,
    (select count(*) from public.core_students cs where cs.institution_id=i.id),
    (select count(*) from public.staff_profiles sp where sp.institution_id=i.id),
    p.id,
    p.code,
    p.name,
    p.monthly_price_pkr,
    coalesce(s.status,'active'),
    s.trial_ends_at,
    s.current_period_end
  from public.institutions i
  left join public.institution_subscriptions s on s.institution_id=i.id
  left join public.subscription_plans p on p.id=s.plan_id
  order by i.created_at desc;
end;
$$;

grant execute on function public.platform_owner_institutions() to authenticated;

commit;


