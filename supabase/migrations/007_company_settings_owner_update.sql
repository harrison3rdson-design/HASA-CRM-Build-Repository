drop policy if exists "owner admin update company settings" on public.company_settings;

create policy "owner admin update company settings"
on public.company_settings for update
to authenticated
using (
  exists (
    select 1
    from public.app_users
    where auth_user_id = auth.uid()
      and active = true
      and role = 'owner_admin'
  )
)
with check (
  exists (
    select 1
    from public.app_users
    where auth_user_id = auth.uid()
      and active = true
      and role = 'owner_admin'
  )
);
