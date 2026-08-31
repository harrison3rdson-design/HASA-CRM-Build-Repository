-- HASA Concepts, LLC
-- Release 1 / Phase 2 Operational + Billing Foundation
-- Assumes Phase 1 migration is already applied.
-- Generated 2026-08-30

-- =========================================================
-- Time tracking
-- =========================================================

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase_id uuid references public.project_phases(id),
  user_id uuid not null references public.app_users(id),
  work_date date not null default current_date,
  activity_type text not null,
  description text,
  hours numeric(8,2) not null default 0 check (hours >= 0),
  billable boolean not null default true,
  billing_rate numeric(12,2) not null default 0,
  internal_cost_rate numeric(12,2) not null default 0,
  is_travel_time boolean not null default false,
  invoice_item_id uuid,
  locked boolean not null default false,
  timer_started_at timestamptz,
  timer_stopped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger time_entries_set_updated_at
before update on public.time_entries
for each row execute function public.set_updated_at();

create or replace function public.prevent_locked_time_changes()
returns trigger
language plpgsql
as $$
begin
  if old.locked = true then
    raise exception 'Invoiced/locked time entries cannot be modified or deleted.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists time_entries_no_update_when_locked on public.time_entries;
create trigger time_entries_no_update_when_locked
before update on public.time_entries
for each row execute function public.prevent_locked_time_changes();

drop trigger if exists time_entries_no_delete_when_locked on public.time_entries;
create trigger time_entries_no_delete_when_locked
before delete on public.time_entries
for each row execute function public.prevent_locked_time_changes();

-- =========================================================
-- Expenses + receipt attachments
-- =========================================================

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_estimate_id uuid references public.proposal_expense_estimates(id),
  expense_date date not null default current_date,
  category text not null,
  description text,
  vendor text,
  actual_cost numeric(12,2) not null default 0 check (actual_cost >= 0),
  billable boolean not null default true,
  billable_amount numeric(12,2) not null default 0 check (billable_amount >= 0),
  billing_rule text not null default 'actual'
    check (billing_rule in (
      'actual','actual_plus_markup','fixed_rate','per_diem',
      'mileage','allowance','included','not_billable'
    )),
  markup_percent numeric(6,3) not null default 0,
  invoice_item_id uuid,
  locked boolean not null default false,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create table if not exists public.expense_attachments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  file_size bigint,
  attachment_type text not null default 'receipt'
    check (attachment_type in (
      'receipt','invoice','confirmation','statement','supporting_document'
    )),
  description text,
  uploaded_by uuid references public.app_users(id),
  uploaded_at timestamptz not null default now()
);

create table if not exists public.receipt_inbox (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references public.app_users(id),
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  file_size bigint,
  captured_at timestamptz not null default now(),
  project_id uuid references public.projects(id),
  expense_id uuid references public.expenses(id),
  status text not null default 'unassigned'
    check (status in ('unassigned','assigned','processed','archived')),
  notes text
);

create or replace function public.prevent_locked_expense_changes()
returns trigger
language plpgsql
as $$
begin
  if old.locked = true then
    raise exception 'Invoiced/locked expenses cannot be modified or deleted.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists expenses_no_update_when_locked on public.expenses;
create trigger expenses_no_update_when_locked
before update on public.expenses
for each row execute function public.prevent_locked_expense_changes();

drop trigger if exists expenses_no_delete_when_locked on public.expenses;
create trigger expenses_no_delete_when_locked
before delete on public.expenses
for each row execute function public.prevent_locked_expense_changes();

-- =========================================================
-- Additional services
-- =========================================================

create table if not exists public.additional_services (
  id uuid primary key default gen_random_uuid(),
  authorization_number text not null unique,
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null,
  billing_type text not null
    check (billing_type in ('fixed','hourly','not_to_exceed','unit','allowance')),
  authorized_amount numeric(12,2) not null default 0 check (authorized_amount >= 0),
  status text not null default 'draft'
    check (status in ('draft','sent','viewed','accepted','declined','cancelled')),
  revision_number integer not null default 0,
  sent_at timestamptz,
  accepted_at timestamptz,
  executed_pdf_path text,
  document_hash text,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger additional_services_set_updated_at
before update on public.additional_services
for each row execute function public.set_updated_at();

create table if not exists public.additional_service_share_links (
  id uuid primary key default gen_random_uuid(),
  additional_service_id uuid not null references public.additional_services(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.additional_service_acceptances (
  id uuid primary key default gen_random_uuid(),
  additional_service_id uuid not null unique references public.additional_services(id),
  signer_name text not null,
  signer_title text,
  signer_email text,
  signer_mobile text,
  acceptance_statement text not null,
  signature_type text not null default 'typed'
    check (signature_type in ('typed','drawn','none')),
  signature_storage_path text,
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  document_hash text,
  executed_pdf_path text
);

create or replace function public.accept_additional_service(
  p_additional_service_id uuid,
  p_signer_name text,
  p_signer_title text default null,
  p_signer_email text default null,
  p_signer_mobile text default null,
  p_acceptance_statement text default 'Accepted',
  p_signature_type text default 'typed',
  p_ip_address inet default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asi public.additional_services%rowtype;
begin
  select * into v_asi
  from public.additional_services
  where id = p_additional_service_id
  for update;

  if not found then
    raise exception 'Additional service authorization not found.';
  end if;

  if v_asi.status = 'accepted' then
    raise exception 'Additional service is already accepted.';
  end if;

  if v_asi.status in ('declined','cancelled') then
    raise exception 'Additional service is not eligible for acceptance.';
  end if;

  insert into public.additional_service_acceptances (
    additional_service_id,
    signer_name,
    signer_title,
    signer_email,
    signer_mobile,
    acceptance_statement,
    signature_type,
    ip_address,
    user_agent
  ) values (
    v_asi.id,
    p_signer_name,
    p_signer_title,
    p_signer_email,
    p_signer_mobile,
    p_acceptance_statement,
    p_signature_type,
    p_ip_address,
    p_user_agent
  );

  update public.additional_services
  set status = 'accepted',
      accepted_at = now()
  where id = v_asi.id;

  update public.projects
  set additional_services_amount = additional_services_amount + v_asi.authorized_amount
  where id = v_asi.project_id;

  insert into public.activity_log (
    project_id,
    record_type,
    record_id,
    event_type,
    event_description,
    new_values
  ) values (
    v_asi.project_id,
    'additional_service',
    v_asi.id,
    'authorization.accepted',
    'Additional service authorization accepted.',
    jsonb_build_object(
      'authorization_number', v_asi.authorization_number,
      'authorized_amount', v_asi.authorized_amount
    )
  );

  return v_asi.project_id;
end;
$$;

-- =========================================================
-- Billing schedules
-- =========================================================

create table if not exists public.billing_schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sequence_number integer not null,
  description text not null,
  trigger_type text not null
    check (trigger_type in (
      'acceptance','date','percent_complete','milestone','manual','final'
    )),
  percentage numeric(6,3),
  fixed_amount numeric(12,2),
  due_date date,
  milestone_description text,
  completed boolean not null default false,
  invoice_id uuid,
  unique(project_id, sequence_number)
);

-- =========================================================
-- Invoices + invoice items + payments
-- =========================================================

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  project_id uuid not null references public.projects(id),
  client_id uuid not null references public.clients(id),
  invoice_type text not null
    check (invoice_type in (
      'advance','progress','milestone','hourly','expense','final','credit'
    )),
  invoice_date date not null default current_date,
  due_date date,
  status text not null default 'draft'
    check (status in (
      'draft','issued','sent','viewed','partial','paid','past_due','void'
    )),
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  payment_terms text not null default 'NET 15',
  customer_notes text,
  internal_notes text,
  issued_at timestamptz,
  pdf_storage_path text,
  document_hash text,
  locked boolean not null default false,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  item_type text not null
    check (item_type in (
      'professional_fee','progress','hourly','travel_time','expense',
      'additional_service','credit','adjustment'
    )),
  description text not null,
  quantity numeric(12,3) not null default 1,
  rate numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  project_phase_id uuid references public.project_phases(id),
  sort_order integer not null default 0
);

alter table public.time_entries
  add constraint time_entries_invoice_item_fk
  foreign key (invoice_item_id) references public.invoice_items(id);

alter table public.expenses
  add constraint expenses_invoice_item_fk
  foreign key (invoice_item_id) references public.invoice_items(id);

alter table public.billing_schedules
  add constraint billing_schedules_invoice_fk
  foreign key (invoice_id) references public.invoices(id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null
    check (payment_method in ('check','ach','credit_card','wire','cash','other')),
  reference_number text,
  notes text,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now()
);

-- =========================================================
-- Invoice calculations / issue / payment functions
-- =========================================================

create or replace function public.recalculate_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(12,2);
  v_paid numeric(12,2);
  v_tax numeric(12,2);
begin
  select coalesce(sum(amount),0)
  into v_subtotal
  from public.invoice_items
  where invoice_id = p_invoice_id;

  select tax_amount
  into v_tax
  from public.invoices
  where id = p_invoice_id;

  select coalesce(sum(amount),0)
  into v_paid
  from public.payments
  where invoice_id = p_invoice_id;

  update public.invoices
  set subtotal = v_subtotal,
      total = v_subtotal + coalesce(v_tax,0),
      amount_paid = v_paid,
      balance_due = (v_subtotal + coalesce(v_tax,0)) - v_paid,
      status = case
        when status = 'void' then 'void'
        when (v_subtotal + coalesce(v_tax,0)) - v_paid <= 0
             and (v_subtotal + coalesce(v_tax,0)) > 0 then 'paid'
        when v_paid > 0 then 'partial'
        else status
      end
  where id = p_invoice_id;
end;
$$;

create or replace function public.issue_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
begin
  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found.';
  end if;

  if v_invoice.status <> 'draft' then
    raise exception 'Only draft invoices can be issued.';
  end if;

  perform public.recalculate_invoice(p_invoice_id);

  update public.invoices
  set status = 'issued',
      issued_at = now(),
      locked = true
  where id = p_invoice_id;

  update public.time_entries t
  set locked = true
  where exists (
    select 1
    from public.invoice_items i
    where i.id = t.invoice_item_id
      and i.invoice_id = p_invoice_id
  );

  update public.expenses e
  set locked = true
  where exists (
    select 1
    from public.invoice_items i
    where i.id = e.invoice_item_id
      and i.invoice_id = p_invoice_id
  );

  insert into public.activity_log (
    client_id,
    project_id,
    record_type,
    record_id,
    event_type,
    event_description,
    new_values
  )
  select
    client_id,
    project_id,
    'invoice',
    id,
    'invoice.issued',
    'Invoice issued and source time/expense entries locked.',
    jsonb_build_object('invoice_number', invoice_number, 'total', total)
  from public.invoices
  where id = p_invoice_id;
end;
$$;

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date default current_date,
  p_reference_number text default null,
  p_notes text default null,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_payment_id uuid;
begin
  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found.';
  end if;

  perform public.recalculate_invoice(p_invoice_id);

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if v_invoice.status = 'void' then
    raise exception 'Cannot post a payment to a void invoice.';
  end if;

  if p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  if p_amount > v_invoice.balance_due then
    raise exception 'Payment exceeds invoice balance. Use credit/overpayment workflow instead.';
  end if;

  insert into public.payments (
    invoice_id,
    payment_date,
    amount,
    payment_method,
    reference_number,
    notes,
    created_by
  ) values (
    p_invoice_id,
    p_payment_date,
    p_amount,
    p_payment_method,
    p_reference_number,
    p_notes,
    p_created_by
  )
  returning id into v_payment_id;

  perform public.recalculate_invoice(p_invoice_id);

  insert into public.activity_log (
    client_id,
    project_id,
    record_type,
    record_id,
    event_type,
    event_description,
    new_values
  )
  select
    client_id,
    project_id,
    'payment',
    v_payment_id,
    'payment.recorded',
    'Payment recorded against invoice.',
    jsonb_build_object(
      'invoice_number', invoice_number,
      'amount', p_amount,
      'payment_method', p_payment_method
    )
  from public.invoices
  where id = p_invoice_id;

  return v_payment_id;
end;
$$;

create or replace function public.prevent_locked_invoice_changes()
returns trigger
language plpgsql
as $$
begin
  if old.locked = true then
    -- Status/payment-derived fields may still be updated by trusted functions.
    if current_setting('role', true) not in ('postgres','service_role') then
      raise exception 'Issued/locked invoices cannot be directly modified.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists invoices_no_delete_when_locked on public.invoices;
create trigger invoices_no_delete_when_locked
before delete on public.invoices
for each row execute function public.prevent_locked_invoice_changes();

-- =========================================================
-- Project financial view
-- =========================================================

create or replace view public.project_financial_summary as
select
  p.id as project_id,
  p.project_number,
  p.project_name,
  p.original_contract_amount,
  p.additional_services_amount,
  p.authorized_fee,
  coalesce(t.hours_worked,0) as total_hours_worked,
  coalesce(t.billable_time_value,0) as billable_time_value,
  coalesce(t.internal_labor_cost,0) as internal_labor_cost,
  coalesce(e.actual_expenses,0) as actual_expenses,
  coalesce(e.billable_expenses,0) as billable_expenses,
  coalesce(i.total_invoiced,0) as total_invoiced,
  coalesce(i.total_paid,0) as payments_received,
  coalesce(i.outstanding_ar,0) as outstanding_ar,
  greatest(p.authorized_fee - coalesce(i.professional_fee_invoiced,0), 0)
    as remaining_authorized_fee,
  p.authorized_fee
    - coalesce(t.internal_labor_cost,0)
    - coalesce(e.actual_expenses,0)
    as estimated_gross_margin_before_overhead
from public.projects p
left join (
  select
    project_id,
    sum(hours) as hours_worked,
    sum(case when billable then hours * billing_rate else 0 end) as billable_time_value,
    sum(hours * internal_cost_rate) as internal_labor_cost
  from public.time_entries
  group by project_id
) t on t.project_id = p.id
left join (
  select
    project_id,
    sum(actual_cost) as actual_expenses,
    sum(case when billable then billable_amount else 0 end) as billable_expenses
  from public.expenses
  group by project_id
) e on e.project_id = p.id
left join (
  select
    inv.project_id,
    sum(case when inv.status <> 'void' then inv.total else 0 end) as total_invoiced,
    sum(case when inv.status <> 'void' then inv.amount_paid else 0 end) as total_paid,
    sum(case when inv.status <> 'void' then inv.balance_due else 0 end) as outstanding_ar,
    sum(case when inv.status <> 'void' then
      coalesce((
        select sum(ii.amount)
        from public.invoice_items ii
        where ii.invoice_id = inv.id
          and ii.item_type in ('professional_fee','progress','hourly','travel_time','additional_service')
      ),0)
    else 0 end) as professional_fee_invoiced
  from public.invoices inv
  group by inv.project_id
) i on i.project_id = p.id;

-- =========================================================
-- RLS
-- =========================================================

alter table public.time_entries enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_attachments enable row level security;
alter table public.receipt_inbox enable row level security;
alter table public.additional_services enable row level security;
alter table public.additional_service_share_links enable row level security;
alter table public.additional_service_acceptances enable row level security;
alter table public.billing_schedules enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

create policy "authenticated time access"
on public.time_entries for all
to authenticated
using (true)
with check (true);

create policy "authenticated expense access"
on public.expenses for all
to authenticated
using (true)
with check (true);

create policy "authenticated expense attachment access"
on public.expense_attachments for all
to authenticated
using (true)
with check (true);

create policy "authenticated receipt inbox access"
on public.receipt_inbox for all
to authenticated
using (true)
with check (true);

create policy "authenticated additional service access"
on public.additional_services for all
to authenticated
using (true)
with check (true);

create policy "authenticated billing schedule access"
on public.billing_schedules for all
to authenticated
using (true)
with check (true);

create policy "authenticated invoice access"
on public.invoices for all
to authenticated
using (true)
with check (true);

create policy "authenticated invoice item access"
on public.invoice_items for all
to authenticated
using (true)
with check (true);

create policy "authenticated payment access"
on public.payments for all
to authenticated
using (true)
with check (true);

-- Public additional-service links/acceptances are intentionally not exposed
-- directly through anonymous RLS. Use token-validating server routes/functions.
