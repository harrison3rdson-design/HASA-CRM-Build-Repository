-- HASA Concepts Management
-- Phase 1 access-control hardening
-- Keep authorization in both the application and the database.

create schema if not exists private;

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
  limit 1;
$$;

create or replace function private.has_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_role() = any(p_roles), false);
$$;

revoke all on function private.current_user_role() from public, anon, authenticated;
revoke all on function private.has_role(text[]) from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
grant execute on function private.current_user_role() to authenticated, service_role;
grant execute on function private.has_role(text[]) to authenticated, service_role;

-- Application users: an account can inspect its own activation state. Only an
-- active owner administrator can list other internal users.
drop policy if exists "authenticated read users" on public.app_users;
create policy "users read own or owner admin"
on public.app_users for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  or private.has_role(array['owner_admin'])
);

drop policy if exists "authenticated read company settings" on public.company_settings;
create policy "company settings read internal"
on public.company_settings for select
to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));

drop policy if exists "authenticated activity read" on public.activity_log;
create policy "activity read internal"
on public.activity_log for select
to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));

-- Clients and contacts.
drop policy if exists "authenticated read clients" on public.clients;
drop policy if exists "authenticated insert clients" on public.clients;
drop policy if exists "authenticated update clients" on public.clients;
create policy "clients read internal" on public.clients for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "clients insert authorized" on public.clients for insert to authenticated
with check (private.has_role(array['owner_admin','project_manager']));
create policy "clients update authorized" on public.clients for update to authenticated
using (private.has_role(array['owner_admin','project_manager']))
with check (private.has_role(array['owner_admin','project_manager']));

drop policy if exists "authenticated read contacts" on public.contacts;
drop policy if exists "authenticated write contacts" on public.contacts;
create policy "contacts read internal" on public.contacts for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "contacts write authorized" on public.contacts for all to authenticated
using (private.has_role(array['owner_admin','project_manager']))
with check (private.has_role(array['owner_admin','project_manager']));

-- Proposals and their editable children.
drop policy if exists "authenticated read proposals" on public.proposals;
drop policy if exists "authenticated write proposals" on public.proposals;
create policy "proposals read internal" on public.proposals for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "proposals write authorized" on public.proposals for all to authenticated
using (private.has_role(array['owner_admin','project_manager']))
with check (private.has_role(array['owner_admin','project_manager']));

drop policy if exists "authenticated read proposal revisions" on public.proposal_revisions;
drop policy if exists "authenticated write proposal revisions" on public.proposal_revisions;
create policy "proposal revisions read internal" on public.proposal_revisions for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "proposal revisions write authorized" on public.proposal_revisions for all to authenticated
using (private.has_role(array['owner_admin','project_manager']))
with check (private.has_role(array['owner_admin','project_manager']));

drop policy if exists "authenticated proposal section access" on public.proposal_sections;
create policy "proposal sections read internal" on public.proposal_sections for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "proposal sections write authorized" on public.proposal_sections for all to authenticated
using (private.has_role(array['owner_admin','project_manager']))
with check (private.has_role(array['owner_admin','project_manager']));

drop policy if exists "authenticated proposal fee access" on public.proposal_fee_items;
create policy "proposal fees read internal" on public.proposal_fee_items for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "proposal fees write authorized" on public.proposal_fee_items for all to authenticated
using (private.has_role(array['owner_admin','project_manager']))
with check (private.has_role(array['owner_admin','project_manager']));

drop policy if exists "authenticated proposal expense access" on public.proposal_expense_estimates;
create policy "proposal expenses read internal" on public.proposal_expense_estimates for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "proposal expenses write authorized" on public.proposal_expense_estimates for all to authenticated
using (private.has_role(array['owner_admin','project_manager']))
with check (private.has_role(array['owner_admin','project_manager']));

drop policy if exists "proposal materials read internal" on public.proposal_material_items;
drop policy if exists "proposal materials insert authorized" on public.proposal_material_items;
drop policy if exists "proposal materials update authorized" on public.proposal_material_items;
drop policy if exists "proposal materials delete authorized" on public.proposal_material_items;
create policy "proposal materials read internal" on public.proposal_material_items for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "proposal materials insert authorized" on public.proposal_material_items for insert to authenticated
with check (private.has_role(array['owner_admin','project_manager']));
create policy "proposal materials update authorized" on public.proposal_material_items for update to authenticated
using (private.has_role(array['owner_admin','project_manager']))
with check (private.has_role(array['owner_admin','project_manager']));
create policy "proposal materials delete authorized" on public.proposal_material_items for delete to authenticated
using (private.has_role(array['owner_admin','project_manager']));

-- Projects and approved additional services.
drop policy if exists "authenticated project access" on public.projects;
create policy "projects read internal" on public.projects for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "projects write authorized" on public.projects for all to authenticated
using (private.has_role(array['owner_admin','project_manager']))
with check (private.has_role(array['owner_admin','project_manager']));

drop policy if exists "authenticated project phase access" on public.project_phases;
create policy "project phases read internal" on public.project_phases for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "project phases write authorized" on public.project_phases for all to authenticated
using (private.has_role(array['owner_admin','project_manager']))
with check (private.has_role(array['owner_admin','project_manager']));

drop policy if exists "additional services read internal" on public.additional_services;
drop policy if exists "additional services write authorized" on public.additional_services;
create policy "additional services read internal" on public.additional_services for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "additional services write authorized" on public.additional_services for all to authenticated
using (private.has_role(array['owner_admin','project_manager']))
with check (private.has_role(array['owner_admin','project_manager']));

drop policy if exists "additional service labor read internal" on public.additional_service_labor_items;
drop policy if exists "additional service labor insert authorized" on public.additional_service_labor_items;
drop policy if exists "additional service labor update authorized" on public.additional_service_labor_items;
drop policy if exists "additional service labor delete authorized" on public.additional_service_labor_items;
create policy "additional service labor read internal" on public.additional_service_labor_items for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "additional service labor insert authorized" on public.additional_service_labor_items for insert to authenticated
with check (private.has_role(array['owner_admin','project_manager']));
create policy "additional service labor update authorized" on public.additional_service_labor_items for update to authenticated
using (private.has_role(array['owner_admin','project_manager']))
with check (private.has_role(array['owner_admin','project_manager']));
create policy "additional service labor delete authorized" on public.additional_service_labor_items for delete to authenticated
using (private.has_role(array['owner_admin','project_manager']));

drop policy if exists "additional service expense read internal" on public.additional_service_expense_items;
drop policy if exists "additional service expense insert authorized" on public.additional_service_expense_items;
drop policy if exists "additional service expense update authorized" on public.additional_service_expense_items;
drop policy if exists "additional service expense delete authorized" on public.additional_service_expense_items;
create policy "additional service expense read internal" on public.additional_service_expense_items for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "additional service expense insert authorized" on public.additional_service_expense_items for insert to authenticated
with check (private.has_role(array['owner_admin','project_manager']));
create policy "additional service expense update authorized" on public.additional_service_expense_items for update to authenticated
using (private.has_role(array['owner_admin','project_manager']))
with check (private.has_role(array['owner_admin','project_manager']));
create policy "additional service expense delete authorized" on public.additional_service_expense_items for delete to authenticated
using (private.has_role(array['owner_admin','project_manager']));

-- Time, expenses and attachments.
drop policy if exists "time read internal" on public.time_entries;
create policy "time read internal" on public.time_entries for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
drop policy if exists "time insert own or manager" on public.time_entries;
create policy "time insert own or manager" on public.time_entries for insert to authenticated
with check (
  (user_id = public.current_app_user_id() and private.has_role(array['owner_admin','project_manager','staff']))
  or private.has_role(array['owner_admin','project_manager'])
);
drop policy if exists "time update own or manager" on public.time_entries;
create policy "time update own or manager" on public.time_entries for update to authenticated
using (
  (user_id = public.current_app_user_id() and locked = false and private.has_role(array['owner_admin','project_manager','staff']))
  or private.has_role(array['owner_admin','project_manager'])
)
with check (
  (user_id = public.current_app_user_id() and private.has_role(array['owner_admin','project_manager','staff']))
  or private.has_role(array['owner_admin','project_manager'])
);

drop policy if exists "expense read internal" on public.expenses;
create policy "expense read internal" on public.expenses for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
drop policy if exists "expense insert internal" on public.expenses;
create policy "expense insert internal" on public.expenses for insert to authenticated
with check (private.has_role(array['owner_admin','project_manager','staff','accounting']));
drop policy if exists "expense update authorized" on public.expenses;
create policy "expense update authorized" on public.expenses for update to authenticated
using (locked = false and private.has_role(array['owner_admin','project_manager','staff','accounting']))
with check (private.has_role(array['owner_admin','project_manager','staff','accounting']));

drop policy if exists "authenticated expense attachment access" on public.expense_attachments;
create policy "expense attachments read internal" on public.expense_attachments for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "expense attachments write authorized" on public.expense_attachments for all to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting']))
with check (private.has_role(array['owner_admin','project_manager','staff','accounting']));

drop policy if exists "authenticated receipt inbox access" on public.receipt_inbox;
create policy "receipt inbox read internal" on public.receipt_inbox for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "receipt inbox write authorized" on public.receipt_inbox for all to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting']))
with check (private.has_role(array['owner_admin','project_manager','staff','accounting']));

-- Billing and internal documents.
drop policy if exists "authenticated billing schedule access" on public.billing_schedules;
create policy "billing schedules read internal" on public.billing_schedules for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "billing schedules write authorized" on public.billing_schedules for all to authenticated
using (private.has_role(array['owner_admin','project_manager','accounting']))
with check (private.has_role(array['owner_admin','project_manager','accounting']));

drop policy if exists "invoice read internal" on public.invoices;
drop policy if exists "invoice create authorized" on public.invoices;
drop policy if exists "invoice update authorized" on public.invoices;
create policy "invoice read internal" on public.invoices for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "invoice create authorized" on public.invoices for insert to authenticated
with check (private.has_role(array['owner_admin','project_manager','accounting']));
create policy "invoice update authorized" on public.invoices for update to authenticated
using (private.has_role(array['owner_admin','accounting']))
with check (private.has_role(array['owner_admin','accounting']));

drop policy if exists "invoice items read internal" on public.invoice_items;
drop policy if exists "invoice items write authorized" on public.invoice_items;
create policy "invoice items read internal" on public.invoice_items for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "invoice items write authorized" on public.invoice_items for all to authenticated
using (private.has_role(array['owner_admin','project_manager','accounting']))
with check (private.has_role(array['owner_admin','project_manager','accounting']));

drop policy if exists "payments read internal" on public.payments;
drop policy if exists "payments create authorized" on public.payments;
create policy "payments read internal" on public.payments for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "payments create authorized" on public.payments for insert to authenticated
with check (private.has_role(array['owner_admin','accounting']));

drop policy if exists "documents read internal" on public.documents;
drop policy if exists "documents write authorized" on public.documents;
create policy "documents read internal" on public.documents for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "documents write authorized" on public.documents for all to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting']))
with check (private.has_role(array['owner_admin','project_manager','staff','accounting']));

drop policy if exists "generated documents read internal" on public.generated_documents;
drop policy if exists "generated documents create authorized" on public.generated_documents;
create policy "generated documents read internal" on public.generated_documents for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "generated documents create authorized" on public.generated_documents for insert to authenticated
with check (private.has_role(array['owner_admin','project_manager','accounting']));

drop policy if exists "deliveries read internal" on public.document_deliveries;
drop policy if exists "deliveries create authorized" on public.document_deliveries;
create policy "deliveries read internal" on public.document_deliveries for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
create policy "deliveries create authorized" on public.document_deliveries for insert to authenticated
with check (private.has_role(array['owner_admin','project_manager','accounting']));

-- The old public helpers are no longer required after every policy above has
-- moved to the non-exposed private schema.
drop function public.has_role(text[]);
drop function public.current_user_role();
