-- HASA Concepts Release 1 / Phase 9
-- Cross-phase compatibility and production hardening.

-- Phase 8 acceptance needs these timestamps but the original proposals table did not have them.
alter table public.proposals
  add column if not exists sent_at timestamptz,
  add column if not exists accepted_at timestamptz;

-- Additional-service immutability state used by the finalized acceptance workflow.
alter table public.additional_services
  add column if not exists locked boolean not null default false;

-- Ensure project-source revision uniqueness to make proposal acceptance idempotent.
create unique index if not exists projects_source_revision_unique
on public.projects(source_revision_id)
where source_revision_id is not null;

-- One active timer per internal user.
create unique index if not exists time_entries_one_active_timer_per_user
on public.time_entries(user_id)
where timer_started_at is not null and timer_stopped_at is null and locked = false;

-- Restrict direct execution of security-definer acceptance functions.
revoke all on function public.finalize_proposal_acceptance(
  text,text,text,text,text,text,text,text,text,text,text
) from public, anon, authenticated;

revoke all on function public.finalize_additional_service_acceptance(
  text,text,text,text,text,text,text,text,text,text,text
) from public, anon, authenticated;

-- Server/service role invokes these functions through controlled endpoints.
