-- Phase 2 security hardening: remove unused anonymous database privileges and
-- prevent future migrations from granting them back by default.

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from public;

-- These privileges bypass row-level security and are unnecessary for normal
-- authenticated application traffic through PostgREST.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- RLS policies call this invoker function for authenticated users.
grant execute on function public.current_app_user_id() to authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;
