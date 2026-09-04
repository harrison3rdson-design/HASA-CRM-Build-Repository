-- Capture the production security posture in source-controlled migrations.
-- These sequence tables are internal implementation details. RLS is enabled
-- without client policies so only trusted server-side roles can access rows.
alter table public.invoice_number_sequences enable row level security;
alter table public.additional_service_sequences enable row level security;

-- Ensure the financial view observes the caller''s grants and underlying RLS.
alter view public.project_financial_summary
  set (security_invoker = true);

-- Pin trigger/helper resolution to the intended schema.
alter function public.set_updated_at()
  set search_path = public;
alter function public.current_app_user_id()
  set search_path = public;
alter function public.prevent_locked_expense_changes()
  set search_path = public;
alter function public.prevent_locked_revision_delete()
  set search_path = public;
alter function public.prevent_locked_time_changes()
  set search_path = public;
alter function public.prevent_locked_invoice_changes()
  set search_path = public;

-- Privileged workflows are invoked only by trusted server-side application
-- code. Remove the direct PostgREST RPC surface from browser-facing roles.
revoke execute on function public.accept_additional_service(
  uuid, text, text, text, text, text, text, inet, text
) from public, anon, authenticated;
revoke execute on function public.accept_proposal_revision(
  uuid, text, text, text, text, text, text, inet, text
) from public, anon, authenticated;
revoke execute on function public.attach_executed_authorization_document(
  uuid, text, text
) from public, anon, authenticated;
revoke execute on function public.attach_executed_proposal_document(
  uuid, text, text
) from public, anon, authenticated;
revoke execute on function public.attach_invoice_document(
  uuid, text, text
) from public, anon, authenticated;
revoke execute on function public.issue_invoice(uuid)
  from public, anon, authenticated;
revoke execute on function public.mark_past_due_invoices()
  from public, anon, authenticated;
revoke execute on function public.next_additional_service_number(uuid)
  from public, anon, authenticated;
revoke execute on function public.next_invoice_number(uuid)
  from public, anon, authenticated;
revoke execute on function public.recalculate_invoice(uuid)
  from public, anon, authenticated;
revoke execute on function public.record_invoice_payment(
  uuid, numeric, text, date, text, text, uuid
) from public, anon, authenticated;
revoke execute on function public.register_additional_service_view(text)
  from public, anon, authenticated;
revoke execute on function public.register_proposal_view(text)
  from public, anon, authenticated;

grant execute on function public.accept_additional_service(
  uuid, text, text, text, text, text, text, inet, text
) to service_role;
grant execute on function public.accept_proposal_revision(
  uuid, text, text, text, text, text, text, inet, text
) to service_role;
grant execute on function public.attach_executed_authorization_document(
  uuid, text, text
) to service_role;
grant execute on function public.attach_executed_proposal_document(
  uuid, text, text
) to service_role;
grant execute on function public.attach_invoice_document(
  uuid, text, text
) to service_role;
grant execute on function public.issue_invoice(uuid) to service_role;
grant execute on function public.mark_past_due_invoices() to service_role;
grant execute on function public.next_additional_service_number(uuid)
  to service_role;
grant execute on function public.next_invoice_number(uuid) to service_role;
grant execute on function public.recalculate_invoice(uuid) to service_role;
grant execute on function public.record_invoice_payment(
  uuid, numeric, text, date, text, text, uuid
) to service_role;
grant execute on function public.register_additional_service_view(text)
  to service_role;
grant execute on function public.register_proposal_view(text)
  to service_role;
