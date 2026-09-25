-- Make Data API exposure explicit before Supabase removes automatic grants for
-- new public-schema tables. Existing anonymous access remains fully revoked.

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated, service_role;

-- Reset current table grants so the declarations below are the complete,
-- reviewable Data API surface rather than additions to inherited defaults.
revoke all privileges on table
  public.activity_log,
  public.additional_service_acceptances,
  public.additional_service_expense_items,
  public.additional_service_labor_items,
  public.additional_service_sequences,
  public.additional_service_share_links,
  public.additional_services,
  public.app_users,
  public.billing_schedules,
  public.clients,
  public.company_settings,
  public.contacts,
  public.document_deliveries,
  public.documents,
  public.expense_attachments,
  public.expenses,
  public.generated_documents,
  public.invoice_items,
  public.invoice_number_sequences,
  public.invoices,
  public.payments,
  public.project_phases,
  public.projects,
  public.proposal_acceptances,
  public.proposal_alternates,
  public.proposal_expense_estimates,
  public.proposal_fee_items,
  public.proposal_material_items,
  public.proposal_revisions,
  public.proposal_sections,
  public.proposal_share_links,
  public.proposals,
  public.receipt_inbox,
  public.time_entries,
  public.unit_service_entries
from anon, authenticated, service_role;

-- Authenticated CRM users receive the same CRUD surface as before. RLS policies
-- remain the row-level authorization boundary for every table in this list.
grant select, insert, update, delete on table
  public.activity_log,
  public.additional_service_expense_items,
  public.additional_service_labor_items,
  public.additional_services,
  public.app_users,
  public.billing_schedules,
  public.clients,
  public.company_settings,
  public.contacts,
  public.document_deliveries,
  public.documents,
  public.expense_attachments,
  public.expenses,
  public.generated_documents,
  public.invoice_items,
  public.invoices,
  public.payments,
  public.project_phases,
  public.projects,
  public.proposal_alternates,
  public.proposal_expense_estimates,
  public.proposal_fee_items,
  public.proposal_material_items,
  public.proposal_revisions,
  public.proposal_sections,
  public.proposals,
  public.receipt_inbox,
  public.time_entries,
  public.unit_service_entries
to authenticated, service_role;

-- These records are written and consumed only by trusted server workflows.
grant select, insert, update, delete on table
  public.additional_service_acceptances,
  public.additional_service_sequences,
  public.additional_service_share_links,
  public.invoice_number_sequences,
  public.proposal_acceptances,
  public.proposal_share_links
to service_role;

revoke all privileges on sequence public.clients_client_number_seq
from anon, authenticated, service_role;
grant usage, select, update on sequence public.clients_client_number_seq
to authenticated, service_role;
