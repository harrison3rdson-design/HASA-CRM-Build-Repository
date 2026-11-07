-- Allow direct client invoices that do not originate from an approved project.

alter table public.invoices
  alter column project_id drop not null,
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

alter table public.invoices
  drop constraint if exists invoices_invoice_type_check;

alter table public.invoices
  add constraint invoices_invoice_type_check
  check (invoice_type in (
    'advance','progress','milestone','hourly','expense','final','credit','standalone'
  ));

alter table public.invoices
  drop constraint if exists invoices_project_type_consistency;

alter table public.invoices
  add constraint invoices_project_type_consistency
  check (
    (project_id is null and invoice_type = 'standalone')
    or (project_id is not null and invoice_type <> 'standalone')
  );

create table if not exists public.standalone_invoice_number_sequences (
  invoice_year integer primary key check (invoice_year between 2000 and 9999),
  last_sequence integer not null default 0 check (last_sequence >= 0),
  updated_at timestamptz not null default now()
);

alter table public.standalone_invoice_number_sequences enable row level security;

revoke all on table public.standalone_invoice_number_sequences
from public, anon, authenticated;

grant select, insert, update, delete on table public.standalone_invoice_number_sequences
to service_role;

create or replace function public.next_standalone_invoice_number(
  p_invoice_date date default current_date
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer := extract(year from p_invoice_date)::integer;
  v_sequence integer;
begin
  insert into public.standalone_invoice_number_sequences(invoice_year, last_sequence)
  values (v_year, 1)
  on conflict (invoice_year)
  do update set
    last_sequence = public.standalone_invoice_number_sequences.last_sequence + 1,
    updated_at = now()
  returning last_sequence into v_sequence;

  return format('%s-DIRECT-%s', v_year, lpad(v_sequence::text, 3, '0'));
end;
$$;

revoke execute on function public.next_standalone_invoice_number(date)
from public, anon, authenticated;

grant execute on function public.next_standalone_invoice_number(date)
to service_role;

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
  v_invoice_year integer;
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

  if v_invoice.status <> 'draft'
     or v_invoice.locked
     or v_invoice.issued_at is not null
     or v_invoice.sent_at is not null then
    raise exception 'Only an unissued, unlocked draft invoice can be deleted.';
  end if;

  if exists (
    select 1 from public.payments where invoice_id = p_invoice_id
  ) then
    raise exception 'An invoice with a payment cannot be deleted.';
  end if;

  if exists (
    select 1
    from public.document_deliveries
    where document_type = 'invoice'
      and related_record_id = p_invoice_id
      and (sent_at is not null or status in ('queued', 'sent', 'delivered'))
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

  if v_invoice.project_id is not null then
    select project_number into v_project_number
    from public.projects
    where id = v_invoice.project_id;

    if not found then
      raise exception 'The invoice project was not found.';
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
  else
    if v_invoice.invoice_number !~ '^[0-9]{4}-DIRECT-[0-9]+$'
       or split_part(v_invoice.invoice_number, '-', 1) <> extract(year from v_invoice.invoice_date)::integer::text then
      raise exception 'This direct invoice number cannot be released automatically.';
    end if;

    v_invoice_year := split_part(v_invoice.invoice_number, '-', 1)::integer;
    v_invoice_sequence := split_part(v_invoice.invoice_number, '-', 3)::integer;

    perform 1
    from public.standalone_invoice_number_sequences
    where invoice_year = v_invoice_year
      and last_sequence = v_invoice_sequence
    for update;
  end if;

  if not found then
    raise exception 'Delete newer draft invoices in this numbering series first. Only the latest invoice number can be released.';
  end if;

  update public.time_entries t
  set invoice_item_id = null
  where t.invoice_item_id in (
    select ii.id from public.invoice_items ii where ii.invoice_id = p_invoice_id
  );
  get diagnostics v_released_time_entries = row_count;

  update public.expenses e
  set invoice_item_id = null
  where e.invoice_item_id in (
    select ii.id from public.invoice_items ii where ii.invoice_id = p_invoice_id
  );
  get diagnostics v_released_expenses = row_count;

  update public.billing_schedules
  set invoice_id = null
  where invoice_id = p_invoice_id;

  insert into public.activity_log (
    client_id, project_id, record_type, record_id, event_type, event_description, new_values
  ) values (
    v_invoice.client_id,
    v_invoice.project_id,
    'invoice',
    v_invoice.id,
    'invoice.deleted',
    'Unissued draft invoice deleted and its invoice number released.',
    jsonb_build_object(
      'invoice_number', v_invoice.invoice_number,
      'number_released', true,
      'time_entries_released', v_released_time_entries,
      'expenses_released', v_released_expenses
    )
  );

  delete from public.document_deliveries
  where document_type = 'invoice' and related_record_id = p_invoice_id;

  delete from public.generated_documents
  where document_type in ('invoice', 'receipt_appendix')
    and related_record_id = p_invoice_id
    and not locked;

  delete from public.invoices where id = p_invoice_id;

  if v_invoice.project_id is not null then
    update public.invoice_number_sequences
    set last_sequence = greatest(0, v_invoice_sequence - 1), updated_at = now()
    where project_id = v_invoice.project_id and last_sequence = v_invoice_sequence;
  else
    update public.standalone_invoice_number_sequences
    set last_sequence = greatest(0, v_invoice_sequence - 1), updated_at = now()
    where invoice_year = v_invoice_year and last_sequence = v_invoice_sequence;
  end if;

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

