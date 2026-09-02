alter table public.invoices
  add column if not exists sent_at timestamptz;

create or replace function public.delete_unissued_draft_invoice(p_invoice_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_project_number text;
  v_invoice_sequence integer;
  v_released_time_entries integer := 0;
  v_released_expenses integer := 0;
begin
  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found.';
  end if;

  select project_number into v_project_number
  from public.projects
  where id = v_invoice.project_id;

  if not found then
    raise exception 'The invoice project was not found.';
  end if;

  if v_invoice.status <> 'draft'
     or v_invoice.locked
     or v_invoice.issued_at is not null
     or v_invoice.sent_at is not null then
    raise exception 'Only an unissued, unlocked draft invoice can be deleted.';
  end if;

  if v_invoice.invoice_number !~ '^[0-9]{4}-[0-9]{4}-[0-9]+$'
     or split_part(v_invoice.invoice_number, '-', 1) <> left(v_project_number, 4)
     or split_part(v_invoice.invoice_number, '-', 2) <> right(v_project_number, 4) then
    raise exception 'This invoice number cannot be released automatically.';
  end if;

  v_invoice_sequence := split_part(v_invoice.invoice_number, '-', 3)::integer;

  perform 1
  from public.invoice_number_sequences
  where project_id = v_invoice.project_id
    and last_sequence = v_invoice_sequence
  for update;

  if not found then
    raise exception 'Delete newer draft invoices for this project first. Only the latest invoice number can be released.';
  end if;

  if exists (
    select 1
    from public.payments
    where invoice_id = p_invoice_id
  ) then
    raise exception 'An invoice with a payment cannot be deleted.';
  end if;

  if exists (
    select 1
    from public.document_deliveries
    where document_type = 'invoice'
      and related_record_id = p_invoice_id
      and (
        sent_at is not null
        or status in ('queued', 'sent', 'delivered')
      )
  ) then
    raise exception 'An invoice that was issued to a customer cannot be deleted.';
  end if;

  if exists (
    select 1
    from public.generated_documents
    where document_type in ('invoice', 'receipt_appendix')
      and related_record_id = p_invoice_id
      and locked
  ) then
    raise exception 'An invoice with a locked generated document cannot be deleted.';
  end if;

  update public.time_entries t
  set invoice_item_id = null
  where t.invoice_item_id in (
    select ii.id
    from public.invoice_items ii
    where ii.invoice_id = p_invoice_id
  );
  get diagnostics v_released_time_entries = row_count;

  update public.expenses e
  set invoice_item_id = null
  where e.invoice_item_id in (
    select ii.id
    from public.invoice_items ii
    where ii.invoice_id = p_invoice_id
  );
  get diagnostics v_released_expenses = row_count;

  update public.billing_schedules
  set invoice_id = null
  where invoice_id = p_invoice_id;

  insert into public.activity_log (
    client_id,
    project_id,
    record_type,
    record_id,
    event_type,
    event_description,
    new_values
  ) values (
    v_invoice.client_id,
    v_invoice.project_id,
    'invoice',
    v_invoice.id,
    'invoice.deleted',
    'Unissued draft invoice deleted, linked work released, and invoice number released.',
    jsonb_build_object(
      'invoice_number', v_invoice.invoice_number,
      'number_released', true,
      'time_entries_released', v_released_time_entries,
      'expenses_released', v_released_expenses
    )
  );

  delete from public.document_deliveries
  where document_type = 'invoice'
    and related_record_id = p_invoice_id;

  delete from public.generated_documents
  where document_type in ('invoice', 'receipt_appendix')
    and related_record_id = p_invoice_id
    and not locked;

  delete from public.invoices
  where id = p_invoice_id;

  update public.invoice_number_sequences
  set last_sequence = greatest(0, v_invoice_sequence - 1),
      updated_at = now()
  where project_id = v_invoice.project_id
    and last_sequence = v_invoice_sequence;

  if not found then
    raise exception 'The invoice number changed before it could be released.';
  end if;

  return jsonb_build_object(
    'invoice_number', v_invoice.invoice_number,
    'project_id', v_invoice.project_id,
    'time_entries_released', v_released_time_entries,
    'expenses_released', v_released_expenses
  );
end;
$$;

revoke execute on function public.delete_unissued_draft_invoice(uuid)
from public, anon, authenticated;

grant execute on function public.delete_unissued_draft_invoice(uuid)
to service_role;
