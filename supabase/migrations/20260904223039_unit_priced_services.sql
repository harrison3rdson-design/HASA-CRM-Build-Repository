-- Generalize proposal service pricing and carry approved per-unit work through
-- project activity and invoice generation without exposing new tables publicly.

alter table public.proposal_fee_items
  add column if not exists unit text;

-- This is a schema backfill only. Temporarily suspend the immutable-revision
-- trigger so locked proposal content remains semantically unchanged while the
-- new display unit is populated. The surrounding migration transaction
-- guarantees the trigger is restored if any later statement fails.
alter table public.proposal_fee_items
  disable trigger proposal_fee_items_no_changes_when_locked;

update public.proposal_fee_items
set unit = case
  when billing_type = 'hourly' then 'hour'
  when billing_type = 'unit' then 'unit'
  when billing_type = 'fixed' then 'project'
  else 'item'
end
where unit is null or nullif(btrim(unit), '') is null;

alter table public.proposal_fee_items
  enable trigger proposal_fee_items_no_changes_when_locked;

alter table public.proposal_fee_items
  alter column unit set default 'hour',
  alter column unit set not null;

alter table public.proposal_fee_items
  drop constraint if exists proposal_fee_items_billing_type_check;

alter table public.proposal_fee_items
  add constraint proposal_fee_items_billing_type_check
  check (billing_type in (
    'fixed','hourly','unit','included','not_to_exceed','allowance','optional'
  ));

create or replace function public.round_proposal_labor_hours_up()
returns trigger
language plpgsql
as $$
begin
  if new.billing_type = 'hourly' then
    new.quantity := ceil(new.quantity * 2) / 2;
    new.unit := 'hour';
    new.amount := round(new.quantity * new.rate, 2);
  elsif new.billing_type = 'unit' then
    if nullif(btrim(new.unit), '') is null then
      raise exception 'A unit label is required for per-unit services.';
    end if;
    new.amount := round(new.quantity * new.rate, 2);
  elsif new.billing_type = 'fixed' then
    new.quantity := 1;
    new.unit := 'project';
    new.amount := round(new.rate, 2);
  elsif new.billing_type = 'included' then
    new.quantity := 1;
    new.unit := 'included';
    new.rate := 0;
    new.amount := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists proposal_fee_items_round_hours_up on public.proposal_fee_items;
create trigger proposal_fee_items_round_hours_up
before insert or update of quantity, rate, billing_type, unit on public.proposal_fee_items
for each row execute function public.round_proposal_labor_hours_up();

create or replace function public.update_proposal_revision_draft_v5(
  p_revision_id uuid,
  p_payment_terms text,
  p_validity_days integer,
  p_billing_method text,
  p_proposal_terms text,
  p_sections jsonb,
  p_fee_items jsonb,
  p_expense_items jsonb,
  p_material_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_proposal_id uuid;
  v_professional_fee numeric(12,2);
begin
  if exists (
    select 1
    from jsonb_to_recordset(p_fee_items) as fee(
      description text, billing_type text, quantity numeric, unit text,
      rate numeric, sort_order integer
    )
    where nullif(btrim(fee.description), '') is null
       or fee.billing_type not in ('hourly', 'unit', 'fixed', 'included')
       or fee.quantity is null or fee.quantity <= 0
       or fee.rate is null or fee.rate < 0
       or nullif(btrim(fee.unit), '') is null
       or (fee.billing_type = 'hourly' and mod(fee.quantity, 0.5) <> 0)
  ) then
    raise exception 'Service lines contain invalid pricing values.';
  end if;

  v_proposal_id := public.update_proposal_revision_draft_v4(
    p_revision_id, p_payment_terms, p_validity_days, p_billing_method,
    p_proposal_terms, p_sections, p_fee_items, p_expense_items, p_material_items
  );

  delete from public.proposal_fee_items
  where proposal_revision_id = p_revision_id;

  insert into public.proposal_fee_items (
    proposal_revision_id, description, billing_type, quantity, unit,
    rate, amount, sort_order
  )
  select
    p_revision_id,
    btrim(fee.description),
    fee.billing_type,
    case when fee.billing_type in ('fixed', 'included') then 1 else fee.quantity end,
    case
      when fee.billing_type = 'hourly' then 'hour'
      when fee.billing_type = 'fixed' then 'project'
      when fee.billing_type = 'included' then 'included'
      else btrim(fee.unit)
    end,
    case when fee.billing_type = 'included' then 0 else fee.rate end,
    case
      when fee.billing_type = 'included' then 0
      when fee.billing_type = 'fixed' then round(fee.rate, 2)
      else round(fee.quantity * fee.rate, 2)
    end,
    coalesce(fee.sort_order, 0)
  from jsonb_to_recordset(p_fee_items) as fee(
    description text, billing_type text, quantity numeric, unit text,
    rate numeric, sort_order integer
  );

  select coalesce(sum(amount), 0)
  into v_professional_fee
  from public.proposal_fee_items
  where proposal_revision_id = p_revision_id;

  update public.proposal_revisions
  set professional_fee = v_professional_fee
  where id = p_revision_id and locked = false;

  if not found then
    raise exception 'The proposal revision changed before its service pricing could be saved.';
  end if;

  return v_proposal_id;
end;
$$;

revoke all on function public.update_proposal_revision_draft_v5(
  uuid, text, integer, text, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.update_proposal_revision_draft_v5(
  uuid, text, integer, text, text, jsonb, jsonb, jsonb, jsonb
) to service_role;

alter table public.invoice_items
  add column if not exists unit text;

update public.invoice_items
set unit = case
  when item_type in ('hourly', 'travel_time') then 'hour'
  else 'item'
end
where unit is null or nullif(btrim(unit), '') is null;

alter table public.invoice_items
  alter column unit set default 'item',
  alter column unit set not null;

alter table public.invoice_items
  drop constraint if exists invoice_items_item_type_check;

alter table public.invoice_items
  add constraint invoice_items_item_type_check
  check (item_type in (
    'professional_fee','progress','hourly','travel_time','unit_service','expense',
    'additional_service','credit','adjustment'
  ));

create or replace function public.round_invoice_time_hours_up()
returns trigger
language plpgsql
as $$
begin
  if new.item_type in ('hourly', 'travel_time') then
    new.quantity := ceil(new.quantity * 2) / 2;
    new.unit := 'hour';
    new.amount := round(new.quantity * new.rate, 2);
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_items_round_time_hours_up on public.invoice_items;
create trigger invoice_items_round_time_hours_up
before insert or update of quantity, rate, item_type, unit on public.invoice_items
for each row execute function public.round_invoice_time_hours_up();

create table public.unit_service_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_fee_item_id uuid not null references public.proposal_fee_items(id),
  work_date date not null default current_date,
  quantity numeric(12,3) not null check (quantity > 0),
  unit text not null,
  billing_rate numeric(12,2) not null check (billing_rate >= 0),
  description text,
  billable boolean not null default true,
  invoice_item_id uuid references public.invoice_items(id) on delete set null,
  locked boolean not null default false,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index unit_service_entries_project_unbilled_idx
  on public.unit_service_entries(project_id, invoice_item_id, work_date);
create index unit_service_entries_source_idx
  on public.unit_service_entries(source_fee_item_id);

create trigger unit_service_entries_set_updated_at
before update on public.unit_service_entries
for each row execute function public.set_updated_at();

create or replace function public.validate_unit_service_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fee_revision_id uuid;
  v_fee_billing_type text;
  v_fee_unit text;
  v_fee_rate numeric;
  v_revision_id uuid;
begin
  select fee.proposal_revision_id, fee.billing_type, fee.unit, fee.rate,
    project.source_revision_id
  into v_fee_revision_id, v_fee_billing_type, v_fee_unit, v_fee_rate,
    v_revision_id
  from public.proposal_fee_items fee
  join public.projects project on project.id = new.project_id
  where fee.id = new.source_fee_item_id;

  if not found or v_revision_id is distinct from v_fee_revision_id then
    raise exception 'The selected service is not part of this project''s accepted proposal.';
  end if;
  if v_fee_billing_type <> 'unit' then
    raise exception 'Only approved per-unit services can be recorded here.';
  end if;

  new.unit := v_fee_unit;
  new.billing_rate := v_fee_rate;
  return new;
end;
$$;

create trigger unit_service_entries_validate_source
before insert or update of project_id, source_fee_item_id
on public.unit_service_entries
for each row execute function public.validate_unit_service_entry();

create or replace function public.prevent_locked_unit_service_changes()
returns trigger
language plpgsql
as $$
begin
  if old.locked or (
    tg_op = 'UPDATE'
    and old.invoice_item_id is not null
    and new.invoice_item_id is not null
  ) or (
    tg_op = 'DELETE'
    and old.invoice_item_id is not null
  ) then
    raise exception 'Invoiced or locked unit work cannot be modified or deleted.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger unit_service_entries_no_update_when_locked
before update on public.unit_service_entries
for each row
when (old.locked or old.invoice_item_id is not null)
execute function public.prevent_locked_unit_service_changes();

create trigger unit_service_entries_no_delete_when_locked
before delete on public.unit_service_entries
for each row execute function public.prevent_locked_unit_service_changes();

alter table public.unit_service_entries enable row level security;
revoke all on public.unit_service_entries from public, anon;
grant select, insert, delete on public.unit_service_entries to authenticated;
grant all on public.unit_service_entries to service_role;

create policy "unit service entries read internal"
on public.unit_service_entries for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));

create policy "unit service entries create authorized"
on public.unit_service_entries for insert to authenticated
with check (private.has_role(array['owner_admin','project_manager','staff']));

create policy "unit service entries delete authorized"
on public.unit_service_entries for delete to authenticated
using (private.has_role(array['owner_admin','project_manager','staff']));

revoke all on function public.validate_unit_service_entry()
  from public, anon, authenticated;
revoke all on function public.prevent_locked_unit_service_changes()
  from public, anon, authenticated;

create or replace view public.project_financial_summary
with (security_invoker = true)
as
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
    as estimated_gross_margin_before_overhead,
  coalesce(u.billable_unit_value,0) as billable_unit_value
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
    project_id,
    sum(case when billable then quantity * billing_rate else 0 end) as billable_unit_value
  from public.unit_service_entries
  group by project_id
) u on u.project_id = p.id
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
          and ii.item_type in (
            'professional_fee','progress','hourly','travel_time','unit_service','additional_service'
          )
      ),0)
    else 0 end) as professional_fee_invoiced
  from public.invoices inv
  group by inv.project_id
) i on i.project_id = p.id;

create or replace function public.claim_unbilled_unit_service_items(
  p_invoice_id uuid,
  p_zero_amount boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_group record;
  v_item_id uuid;
  v_sort integer;
  v_count integer := 0;
begin
  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then raise exception 'Invoice not found.'; end if;
  if v_invoice.status <> 'draft' or v_invoice.locked then
    raise exception 'Only an unlocked draft invoice can add unit work.';
  end if;

  perform id
  from public.unit_service_entries
  where project_id = v_invoice.project_id
    and billable = true
    and invoice_item_id is null
    and locked = false
  for update;

  select coalesce(max(sort_order), -1) + 1 into v_sort
  from public.invoice_items
  where invoice_id = p_invoice_id;

  for v_group in
    select entry.source_fee_item_id, fee.description as service_description,
      entry.unit, entry.billing_rate, sum(entry.quantity) as quantity,
      count(*)::integer as entry_count
    from public.unit_service_entries entry
    join public.proposal_fee_items fee on fee.id = entry.source_fee_item_id
    where entry.project_id = v_invoice.project_id
      and entry.billable = true
      and entry.invoice_item_id is null
      and entry.locked = false
    group by entry.source_fee_item_id, fee.description, entry.unit, entry.billing_rate
    order by min(entry.work_date), fee.description
  loop
    insert into public.invoice_items (
      invoice_id, item_type, description, quantity, unit, rate, amount, sort_order
    ) values (
      p_invoice_id,
      'unit_service',
      'Original Proposal — ' || v_group.service_description
        || case when p_zero_amount then ' (included in fixed fee)' else '' end,
      v_group.quantity,
      v_group.unit,
      case when p_zero_amount then 0 else v_group.billing_rate end,
      case when p_zero_amount then 0 else round(v_group.quantity * v_group.billing_rate, 2) end,
      v_sort
    ) returning id into v_item_id;

    update public.unit_service_entries
    set invoice_item_id = v_item_id
    where project_id = v_invoice.project_id
      and source_fee_item_id = v_group.source_fee_item_id
      and unit = v_group.unit
      and billing_rate = v_group.billing_rate
      and billable = true
      and invoice_item_id is null
      and locked = false;

    v_sort := v_sort + 1;
    v_count := v_count + v_group.entry_count;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.claim_unbilled_unit_service_items(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_unbilled_unit_service_items(uuid, boolean)
  to service_role;

create or replace function public.build_invoice_workflow_v2(
  p_invoice_id uuid,
  p_include_time boolean default true,
  p_include_expenses boolean default true,
  p_include_unit_work boolean default true,
  p_advance_method text default null,
  p_advance_value numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_context public.project_invoice_context%rowtype;
  v_prior_service_billed numeric(12,2);
  v_remaining_service_fee numeric(12,2);
  v_advance_amount numeric(12,2);
  v_claimed jsonb := jsonb_build_object('time_entries', 0, 'expense_entries', 0);
  v_unit_count integer := 0;
  v_item_count integer;
  v_total numeric(12,2);
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found.'; end if;
  if v_invoice.status <> 'draft' or v_invoice.locked then
    raise exception 'Only an unlocked draft invoice can be built.';
  end if;
  if exists (select 1 from public.invoice_items where invoice_id = p_invoice_id) then
    raise exception 'This draft invoice already has line items.';
  end if;
  if v_invoice.invoice_type not in ('advance', 'progress', 'final') then
    raise exception 'Invoice type must be Advance, Progress, or Final.';
  end if;

  select * into v_context from public.project_invoice_context where id = v_invoice.project_id;
  if not found then raise exception 'Project billing context was not found.'; end if;

  select coalesce(sum(item.amount), 0) into v_prior_service_billed
  from public.invoices prior_invoice
  join public.invoice_items item on item.invoice_id = prior_invoice.id
  where prior_invoice.project_id = v_invoice.project_id
    and prior_invoice.id <> p_invoice_id
    and prior_invoice.status <> 'void'
    and item.item_type in (
      'professional_fee','progress','hourly','travel_time','unit_service','additional_service'
    );

  v_remaining_service_fee := greatest(v_context.service_fee_authorized - v_prior_service_billed, 0);

  if v_invoice.invoice_type = 'advance' then
    if p_advance_method not in ('amount', 'percentage') then
      raise exception 'Choose an advance amount or percentage.';
    end if;
    if coalesce(p_advance_value, 0) <= 0 then
      raise exception 'Advance value must be greater than zero.';
    end if;
    if p_advance_method = 'percentage' then
      if p_advance_value > 100 then raise exception 'Advance percentage cannot exceed 100.'; end if;
      v_advance_amount := round(v_context.service_fee_authorized * p_advance_value / 100, 2);
    else
      v_advance_amount := round(p_advance_value, 2);
    end if;
    if v_advance_amount > v_remaining_service_fee then
      raise exception 'Advance exceeds the remaining authorized service fee of %.',
        to_char(v_remaining_service_fee, 'FM999999990.00');
    end if;
    insert into public.invoice_items (
      invoice_id, item_type, description, quantity, unit, rate, amount, sort_order
    ) values (
      p_invoice_id, 'professional_fee',
      case when p_advance_method = 'percentage'
        then 'Advance payment (' || trim(to_char(p_advance_value, 'FM999990.###')) || '% of authorized services)'
        else 'Advance payment' end,
      1, 'item', v_advance_amount, v_advance_amount, 0
    );
  elsif v_invoice.invoice_type = 'progress' then
    if not p_include_time and not p_include_expenses and not p_include_unit_work then
      raise exception 'Choose unbilled time, expenses, per-unit work, or a combination.';
    end if;
    v_claimed := public.claim_unbilled_invoice_items(
      p_invoice_id, p_include_time, p_include_expenses, false
    );
    if p_include_unit_work then
      v_unit_count := public.claim_unbilled_unit_service_items(p_invoice_id, false);
    end if;
  else
    if v_context.billing_method in ('fixed_fee', 'milestone') then
      if v_remaining_service_fee > 0 then
        insert into public.invoice_items (
          invoice_id, item_type, description, quantity, unit, rate, amount, sort_order
        ) values (
          p_invoice_id, 'professional_fee', 'Final authorized service balance',
          1, 'item', v_remaining_service_fee, v_remaining_service_fee, 0
        );
      end if;
      v_claimed := public.claim_unbilled_invoice_items(p_invoice_id, true, true, true);
      v_unit_count := public.claim_unbilled_unit_service_items(p_invoice_id, true);
    else
      v_claimed := public.claim_unbilled_invoice_items(p_invoice_id, true, true, false);
      v_unit_count := public.claim_unbilled_unit_service_items(p_invoice_id, false);
    end if;
  end if;

  perform public.recalculate_invoice(p_invoice_id);

  select count(*), total into v_item_count, v_total
  from public.invoice_items items
  join public.invoices built_invoice on built_invoice.id = items.invoice_id
  where items.invoice_id = p_invoice_id
  group by built_invoice.total;

  if coalesce(v_item_count, 0) = 0 or coalesce(v_total, 0) <= 0 then
    raise exception 'No billable amount is available for this invoice.';
  end if;

  return v_claimed || jsonb_build_object(
    'unit_service_entries', v_unit_count,
    'invoice_type', v_invoice.invoice_type,
    'authorized_service_fee', v_context.service_fee_authorized,
    'prior_service_billed', v_prior_service_billed,
    'remaining_service_fee_before_invoice', v_remaining_service_fee,
    'invoice_total', v_total
  );
end;
$$;

revoke all on function public.build_invoice_workflow_v2(
  uuid, boolean, boolean, boolean, text, numeric
) from public, anon, authenticated;
grant execute on function public.build_invoice_workflow_v2(
  uuid, boolean, boolean, boolean, text, numeric
) to service_role;
