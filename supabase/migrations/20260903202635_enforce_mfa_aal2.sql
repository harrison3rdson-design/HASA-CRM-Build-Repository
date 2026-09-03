-- Require a verified MFA session before application roles unlock business data.
-- Account activation is checked server-side during enrollment, so app_users can
-- also require AAL2 without blocking first-time authenticator setup.

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select au.role
  from public.app_users as au
  where au.auth_user_id = (select auth.uid())
    and au.active = true
    and coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
  limit 1;
$$;

comment on function private.current_user_role() is
  'Returns the active application role only for sessions verified at AAL2.';

drop policy if exists "users read own or owner admin" on public.app_users;
create policy "users read own or owner admin"
on public.app_users for select
to authenticated
using (
  (
    auth_user_id = (select auth.uid())
    and coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
  )
  or private.has_role(array['owner_admin'])
);
