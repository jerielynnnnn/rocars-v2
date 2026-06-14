-- Run this in Supabase SQL Editor.
-- It lets authenticated customers read/update only their own voucher claims,
-- and lets server-side service-role routes manage voucher claims safely.

grant usage on schema public to authenticated, service_role;

grant select, insert, update on table public.voucher_usage to authenticated;
grant all on table public.voucher_usage to service_role;

grant select, update on table public.vouchers to authenticated;
grant all on table public.vouchers to service_role;

grant insert on table public.notifications to authenticated;
grant all on table public.notifications to service_role;

grant select, insert, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'voucher_usage_id_seq'
  ) then
    grant usage, select on sequence public.voucher_usage_id_seq to authenticated;
    grant all on sequence public.voucher_usage_id_seq to service_role;
  end if;
end $$;

alter table public.voucher_usage enable row level security;

drop policy if exists "Users can view own voucher usage" on public.voucher_usage;
create policy "Users can view own voucher usage"
on public.voucher_usage
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can claim own vouchers" on public.voucher_usage;
create policy "Users can claim own vouchers"
on public.voucher_usage
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own voucher usage" on public.voucher_usage;
create policy "Users can update own voucher usage"
on public.voucher_usage
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Service role can manage voucher usage" on public.voucher_usage;
create policy "Service role can manage voucher usage"
on public.voucher_usage
for all
to service_role
using (true)
with check (true);
