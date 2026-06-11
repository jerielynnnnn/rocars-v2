-- Fix admin product updates failing with:
--   permission denied for table admin_notifications
--
-- Why:
-- Product update triggers can run under the logged-in admin/staff JWT.
-- If admin_notifications has RLS enabled but no INSERT policy for admin/staff,
-- the product update is rolled back even though the product form is valid.

alter table if exists public.admin_notifications enable row level security;
alter table if exists public.admin_logs enable row level security;

grant select, insert, update on public.admin_notifications to authenticated;
grant select, insert on public.admin_logs to authenticated;

drop policy if exists "admin staff can read admin notifications" on public.admin_notifications;
create policy "admin staff can read admin notifications"
on public.admin_notifications
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (
        profiles.role = 'admin'
        or profiles.role = 'staff'
        or profiles.role like 'staff_%'
      )
  )
);

drop policy if exists "admin staff can insert admin notifications" on public.admin_notifications;
create policy "admin staff can insert admin notifications"
on public.admin_notifications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (
        profiles.role = 'admin'
        or profiles.role = 'staff'
        or profiles.role like 'staff_%'
      )
  )
);

drop policy if exists "admin staff can update admin notifications" on public.admin_notifications;
create policy "admin staff can update admin notifications"
on public.admin_notifications
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (
        profiles.role = 'admin'
        or profiles.role = 'staff'
        or profiles.role like 'staff_%'
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (
        profiles.role = 'admin'
        or profiles.role = 'staff'
        or profiles.role like 'staff_%'
      )
  )
);

drop policy if exists "admin staff can read admin logs" on public.admin_logs;
create policy "admin staff can read admin logs"
on public.admin_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (
        profiles.role = 'admin'
        or profiles.role = 'staff'
        or profiles.role like 'staff_%'
      )
  )
);

drop policy if exists "admin staff can insert own admin logs" on public.admin_logs;
create policy "admin staff can insert own admin logs"
on public.admin_logs
for insert
to authenticated
with check (
  admin_id = auth.uid()
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (
        profiles.role = 'admin'
        or profiles.role = 'staff'
        or profiles.role like 'staff_%'
      )
  )
);
