-- Remove every project-owned automatic table and sequence grant. Supabase's
-- platform-owned defaults are managed by Supabase and change on October 30.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated, service_role;
