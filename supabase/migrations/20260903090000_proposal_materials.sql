-- Add separately priced proposal materials and carry accepted material sources
-- into the existing project purchase and invoice workflow.

alter table public.proposal_revisions
  add column if not exists estimated_materials numeric(12,2) not null default 0;

alter table public.proposal_revisions
  drop column estimated_total;

alter table public.proposal_revisions
  add column estimated_total numeric(12,2) generated always as
    (professional_fee + estimated_materials + estimated_expenses) stored;

create table public.proposal_material_items (
  id uuid primary key default gen_random_uuid(),
  proposal_revision_id uuid not null references public.proposal_revisions(id) on delete cascade,
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity >= 0),
  unit text not null default 'each',
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  markup_percent numeric(6,3) not null default 0 check (markup_percent >= 0 and markup_percent <= 999.999),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index proposal_material_items_parent_idx
  on public.proposal_material_items(proposal_revision_id, sort_order);

create or replace function public.calculate_proposal_material_pricing()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.unit_price := round(new.unit_cost * (1 + new.markup_percent / 100), 2);
  new.amount := round(new.quantity * new.unit_price, 2);
  return new;
end;
$$;

revoke all on function public.calculate_proposal_material_pricing() from public, anon, authenticated;

create trigger proposal_material_items_calculate_pricing
before insert or update of quantity, unit_cost, markup_percent
on public.proposal_material_items
for each row execute function public.calculate_proposal_material_pricing();

create trigger proposal_materials_no_changes_when_locked
before insert or update or delete on public.proposal_material_items
for each row execute function public.prevent_locked_revision_item_changes();

alter table public.proposal_material_items enable row level security;

grant select, insert, update, delete on table public.proposal_material_items
  to authenticated, service_role;

create policy "proposal materials read internal"
on public.proposal_material_items for select
to authenticated
using (true);

create policy "proposal materials write authorized"
on public.proposal_material_items for all
to authenticated
using (public.has_role(array['owner_admin','project_manager']))
with check (public.has_role(array['owner_admin','project_manager']));

alter table public.expenses
  add column if not exists source_material_id uuid;

alter table public.expenses
  add constraint expenses_source_material_fk
  foreign key (source_material_id)
  references public.proposal_material_items(id)
  on delete set null;

create index expenses_source_material_idx
  on public.expenses(source_material_id);

alter table public.expenses
  drop constraint if exists expenses_one_approved_source;

alter table public.expenses
  add constraint expenses_one_approved_source
  check (num_nonnulls(source_estimate_id, source_material_id, source_additional_service_expense_item_id) <= 1);

create or replace function public.validate_expense_approved_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_estimate_id is not null and not exists (
    select 1
    from public.projects p
    join public.proposal_expense_estimates item on item.proposal_revision_id = p.source_revision_id
    where p.id = new.project_id and item.id = new.source_estimate_id
  ) then
    raise exception 'The selected expense category is not part of the accepted proposal.';
  end if;

  if new.source_material_id is not null and not exists (
    select 1
    from public.projects p
    join public.proposal_material_items item on item.proposal_revision_id = p.source_revision_id
    where p.id = new.project_id and item.id = new.source_material_id
  ) then
    raise exception 'The selected material is not part of the accepted proposal.';
  end if;

  if new.source_additional_service_expense_item_id is not null and not exists (
    select 1
    from public.additional_service_expense_items item
    join public.additional_services a on a.id = item.additional_service_id
    where item.id = new.source_additional_service_expense_item_id
      and a.project_id = new.project_id
      and a.status = 'accepted'
  ) then
    raise exception 'The selected expense category is not part of an accepted Additional Service.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_expense_approved_source() from public, anon, authenticated;

drop trigger if exists expenses_validate_approved_source on public.expenses;
create trigger expenses_validate_approved_source
before insert or update of project_id, source_estimate_id, source_material_id, source_additional_service_expense_item_id
on public.expenses
for each row execute function public.validate_expense_approved_source();

create or replace function public.update_proposal_revision_draft_v3(
  p_revision_id uuid,
  p_payment_terms text,
  p_validity_days integer,
  p_billing_method text,
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
  v_revision public.proposal_revisions%rowtype;
  v_professional_fee numeric(12,2) := 0;
  v_estimated_expenses numeric(12,2) := 0;
  v_estimated_materials numeric(12,2) := 0;
begin
  select * into v_revision
  from public.proposal_revisions
  where id = p_revision_id
  for update;

  if not found then
    raise exception 'Proposal revision not found.';
  end if;
  if v_revision.locked then
    raise exception 'Sent or accepted proposal revisions are locked and cannot be edited.';
  end if;
  if p_payment_terms not in ('NET 15', 'NET 30', 'NET 90') then
    raise exception 'Payment terms are invalid.';
  end if;
  if p_validity_days is null or p_validity_days < 1 then
    raise exception 'Validity days must be at least 1.';
  end if;
  if coalesce(jsonb_typeof(p_sections), 'null') <> 'array'
     or coalesce(jsonb_typeof(p_fee_items), 'null') <> 'array'
     or coalesce(jsonb_typeof(p_expense_items), 'null') <> 'array'
     or coalesce(jsonb_typeof(p_material_items), 'null') <> 'array' then
    raise exception 'Proposal sections and line items must be arrays.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_sections) as section(
      section_type text, heading text, content text, sort_order integer
    )
    where section.section_type not in (
      'objective', 'consultant_responsibility', 'client_responsibility',
      'deliverable', 'exclusion', 'schedule', 'term', 'custom'
    ) or nullif(btrim(section.content), '') is null
  ) then
    raise exception 'Scope sections contain invalid values.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_fee_items) as fee(
      description text, quantity numeric, rate numeric, sort_order integer
    )
    where nullif(btrim(fee.description), '') is null
       or fee.quantity is null or fee.quantity < 0
       or fee.rate is null or fee.rate < 0
  ) then
    raise exception 'Labor lines contain invalid values.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_expense_items) as expense(
      category text, description text, estimated_quantity numeric, unit text,
      estimated_rate numeric, billing_rule text, markup_percent numeric,
      requires_receipt boolean, sort_order integer
    )
    where nullif(btrim(expense.category), '') is null
       or expense.estimated_quantity is null or expense.estimated_quantity < 0
       or expense.estimated_rate is null or expense.estimated_rate < 0
       or expense.markup_percent is null or expense.markup_percent < 0 or expense.markup_percent > 999.999
       or expense.billing_rule not in (
         'actual', 'actual_plus_markup', 'fixed_rate', 'per_diem',
         'mileage', 'allowance', 'included', 'not_billable'
       )
  ) then
    raise exception 'Expense lines contain invalid values.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_material_items) as material(
      description text, quantity numeric, unit text, unit_cost numeric,
      markup_percent numeric, sort_order integer
    )
    where nullif(btrim(material.description), '') is null
       or material.quantity is null or material.quantity < 0
       or nullif(btrim(material.unit), '') is null
       or material.unit_cost is null or material.unit_cost < 0
       or material.markup_percent is null or material.markup_percent < 0 or material.markup_percent > 999.999
  ) then
    raise exception 'Material lines contain invalid values.';
  end if;

  delete from public.proposal_sections where proposal_revision_id = p_revision_id;
  insert into public.proposal_sections (
    proposal_revision_id, section_type, heading, content, sort_order
  )
  select p_revision_id, section.section_type, nullif(btrim(section.heading), ''),
    btrim(section.content), coalesce(section.sort_order, 0)
  from jsonb_to_recordset(p_sections) as section(
    section_type text, heading text, content text, sort_order integer
  );

  delete from public.proposal_fee_items where proposal_revision_id = p_revision_id;
  insert into public.proposal_fee_items (
    proposal_revision_id, description, billing_type, quantity, rate, amount, sort_order
  )
  select p_revision_id, btrim(fee.description), 'hourly', fee.quantity, fee.rate,
    round(fee.quantity * fee.rate, 2), coalesce(fee.sort_order, 0)
  from jsonb_to_recordset(p_fee_items) as fee(
    description text, quantity numeric, rate numeric, sort_order integer
  );

  delete from public.proposal_expense_estimates where proposal_revision_id = p_revision_id;
  insert into public.proposal_expense_estimates (
    proposal_revision_id, category, description, estimated_quantity, unit,
    estimated_rate, estimated_amount, billing_rule, markup_percent,
    requires_receipt, sort_order
  )
  select p_revision_id, btrim(expense.category), nullif(btrim(expense.description), ''),
    expense.estimated_quantity, nullif(btrim(expense.unit), ''), expense.estimated_rate,
    case
      when expense.billing_rule in ('included', 'not_billable') then 0
      when expense.billing_rule = 'actual_plus_markup' then
        round(expense.estimated_quantity * expense.estimated_rate * (1 + expense.markup_percent / 100), 2)
      else round(expense.estimated_quantity * expense.estimated_rate, 2)
    end,
    expense.billing_rule,
    case when expense.billing_rule = 'actual_plus_markup' then expense.markup_percent else 0 end,
    coalesce(expense.requires_receipt, false), coalesce(expense.sort_order, 0)
  from jsonb_to_recordset(p_expense_items) as expense(
    category text, description text, estimated_quantity numeric, unit text,
    estimated_rate numeric, billing_rule text, markup_percent numeric,
    requires_receipt boolean, sort_order integer
  );

  delete from public.proposal_material_items where proposal_revision_id = p_revision_id;
  insert into public.proposal_material_items (
    proposal_revision_id, description, quantity, unit, unit_cost, markup_percent,
    unit_price, amount, sort_order
  )
  select p_revision_id, btrim(material.description), material.quantity, btrim(material.unit),
    material.unit_cost, material.markup_percent,
    round(material.unit_cost * (1 + material.markup_percent / 100), 2),
    round(material.quantity * round(material.unit_cost * (1 + material.markup_percent / 100), 2), 2),
    coalesce(material.sort_order, 0)
  from jsonb_to_recordset(p_material_items) as material(
    description text, quantity numeric, unit text, unit_cost numeric,
    markup_percent numeric, sort_order integer
  );

  select coalesce(sum(amount), 0) into v_professional_fee
  from public.proposal_fee_items where proposal_revision_id = p_revision_id;

  select coalesce(sum(estimated_amount), 0) into v_estimated_expenses
  from public.proposal_expense_estimates where proposal_revision_id = p_revision_id;

  select coalesce(sum(amount), 0) into v_estimated_materials
  from public.proposal_material_items where proposal_revision_id = p_revision_id;

  update public.proposal_revisions
  set professional_fee = v_professional_fee,
      estimated_expenses = v_estimated_expenses,
      estimated_materials = v_estimated_materials,
      billing_method = nullif(btrim(p_billing_method), ''),
      payment_terms = p_payment_terms,
      validity_days = p_validity_days
  where id = p_revision_id;

  return v_revision.proposal_id;
end;
$$;

revoke all on function public.update_proposal_revision_draft_v3(
  uuid, text, integer, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.update_proposal_revision_draft_v3(
  uuid, text, integer, text, jsonb, jsonb, jsonb, jsonb
) to service_role;

