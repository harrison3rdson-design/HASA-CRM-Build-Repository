-- Itemized Additional Services become approved project work after acceptance.
-- Draft invoices can atomically claim unbilled time and expenses once.

create table if not exists public.additional_service_labor_items (
  id uuid primary key default gen_random_uuid(),
  additional_service_id uuid not null references public.additional_services(id) on delete cascade,
  description text not null,
  hours numeric(12,3) not null default 0 check (hours >= 0),
  rate numeric(12,2) not null default 0 check (rate >= 0),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.additional_service_expense_items (
  id uuid primary key default gen_random_uuid(),
  additional_service_id uuid not null references public.additional_services(id) on delete cascade,
  category text not null,
  description text,
  estimated_quantity numeric(12,3) not null default 1 check (estimated_quantity >= 0),
  unit text,
  estimated_rate numeric(12,2) not null default 0 check (estimated_rate >= 0),
  estimated_amount numeric(12,2) not null default 0 check (estimated_amount >= 0),
  billing_rule text not null default 'actual'
    check (billing_rule in (
      'actual','actual_plus_markup','fixed_rate','per_diem',
      'mileage','allowance','included','not_billable'
    )),
  markup_percent numeric(6,3) not null default 0,
  requires_receipt boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists additional_service_labor_items_parent_idx
  on public.additional_service_labor_items(additional_service_id, sort_order);

create index if not exists additional_service_expense_items_parent_idx
  on public.additional_service_expense_items(additional_service_id, sort_order);

create or replace function public.round_additional_service_labor_hours_up()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.hours := ceil(new.hours * 2) / 2;
  new.amount := round(new.hours * new.rate, 2);
  return new;
end;
$$;

drop trigger if exists additional_service_labor_items_round_hours_up on public.additional_service_labor_items;
create trigger additional_service_labor_items_round_hours_up
before insert or update of hours, rate on public.additional_service_labor_items
for each row execute function public.round_additional_service_labor_hours_up();

alter table public.additional_service_labor_items
  add constraint additional_service_labor_items_half_hour_increment
  check (mod(hours, 0.5) = 0);

alter table public.additional_service_labor_items enable row level security;
alter table public.additional_service_expense_items enable row level security;

grant select, insert, update, delete on table public.additional_service_labor_items to authenticated, service_role;
grant select, insert, update, delete on table public.additional_service_expense_items to authenticated, service_role;

create policy "additional service labor read internal"
on public.additional_service_labor_items for select
to authenticated
using (true);

create policy "additional service labor write authorized"
on public.additional_service_labor_items for all
to authenticated
using (public.has_role(array['owner_admin','project_manager']))
with check (public.has_role(array['owner_admin','project_manager']));

create policy "additional service expense read internal"
on public.additional_service_expense_items for select
to authenticated
using (true);

create policy "additional service expense write authorized"
on public.additional_service_expense_items for all
to authenticated
using (public.has_role(array['owner_admin','project_manager']))
with check (public.has_role(array['owner_admin','project_manager']));

create or replace function public.prevent_locked_additional_service_item_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_id uuid;
  v_status text;
  v_locked boolean;
begin
  v_parent_id := case when tg_op = 'DELETE' then old.additional_service_id else new.additional_service_id end;

  select status, locked into v_status, v_locked
  from public.additional_services
  where id = v_parent_id;

  if not found then
    raise exception 'Additional service authorization not found.';
  end if;

  if v_locked or v_status <> 'draft' then
    raise exception 'Sent or accepted authorization items cannot be changed.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.prevent_locked_additional_service_item_changes() from public, anon, authenticated;

drop trigger if exists additional_service_labor_items_prevent_locked_changes on public.additional_service_labor_items;
create trigger additional_service_labor_items_prevent_locked_changes
before insert or update or delete on public.additional_service_labor_items
for each row execute function public.prevent_locked_additional_service_item_changes();

drop trigger if exists additional_service_expense_items_prevent_locked_changes on public.additional_service_expense_items;
create trigger additional_service_expense_items_prevent_locked_changes
before insert or update or delete on public.additional_service_expense_items
for each row execute function public.prevent_locked_additional_service_item_changes();

create or replace function public.create_additional_service_draft(
  p_project_id uuid,
  p_description text,
  p_billing_type text,
  p_labor_items jsonb,
  p_expense_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_number text;
  v_amount numeric(12,2);
begin
  if p_billing_type not in ('fixed','hourly','not_to_exceed','unit','allowance') then
    raise exception 'Authorization type is invalid.';
  end if;

  if coalesce(jsonb_array_length(p_labor_items), 0) + coalesce(jsonb_array_length(p_expense_items), 0) = 0 then
    raise exception 'Add at least one labor or expense line to the authorization.';
  end if;

  v_number := public.next_additional_service_number(p_project_id);

  select round(coalesce(sum(value), 0), 2) into v_amount
  from (
    select (item->>'amount')::numeric as value from jsonb_array_elements(coalesce(p_labor_items, '[]'::jsonb)) item
    union all
    select (item->>'estimated_amount')::numeric as value from jsonb_array_elements(coalesce(p_expense_items, '[]'::jsonb)) item
  ) amounts;

  insert into public.additional_services (
    authorization_number, project_id, description, billing_type, authorized_amount, status
  ) values (
    v_number, p_project_id, p_description, p_billing_type, v_amount, 'draft'
  ) returning id into v_id;

  insert into public.additional_service_labor_items (
    additional_service_id, description, hours, rate, amount, sort_order
  )
  select v_id, description, hours, rate, amount, sort_order
  from jsonb_to_recordset(coalesce(p_labor_items, '[]'::jsonb)) as item(
    description text, hours numeric, rate numeric, amount numeric, sort_order integer
  );

  insert into public.additional_service_expense_items (
    additional_service_id, category, description, estimated_quantity, unit,
    estimated_rate, estimated_amount, billing_rule, markup_percent, requires_receipt, sort_order
  )
  select v_id, category, description, estimated_quantity, unit,
    estimated_rate, estimated_amount, billing_rule, markup_percent, requires_receipt, sort_order
  from jsonb_to_recordset(coalesce(p_expense_items, '[]'::jsonb)) as item(
    category text, description text, estimated_quantity numeric, unit text,
    estimated_rate numeric, estimated_amount numeric, billing_rule text,
    markup_percent numeric, requires_receipt boolean, sort_order integer
  );

  return v_id;
end;
$$;

create or replace function public.update_additional_service_draft(
  p_additional_service_id uuid,
  p_description text,
  p_billing_type text,
  p_labor_items jsonb,
  p_expense_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_authorization public.additional_services%rowtype;
  v_amount numeric(12,2);
begin
  select * into v_authorization
  from public.additional_services
  where id = p_additional_service_id
  for update;

  if not found then
    raise exception 'Additional service authorization not found.';
  end if;
  if v_authorization.locked or v_authorization.status <> 'draft' then
    raise exception 'Only an unlocked draft authorization can be edited.';
  end if;
  if p_billing_type not in ('fixed','hourly','not_to_exceed','unit','allowance') then
    raise exception 'Authorization type is invalid.';
  end if;
  if coalesce(jsonb_array_length(p_labor_items), 0) + coalesce(jsonb_array_length(p_expense_items), 0) = 0 then
    raise exception 'Add at least one labor or expense line to the authorization.';
  end if;

  select round(coalesce(sum(value), 0), 2) into v_amount
  from (
    select (item->>'amount')::numeric as value from jsonb_array_elements(coalesce(p_labor_items, '[]'::jsonb)) item
    union all
    select (item->>'estimated_amount')::numeric as value from jsonb_array_elements(coalesce(p_expense_items, '[]'::jsonb)) item
  ) amounts;

  delete from public.additional_service_labor_items where additional_service_id = p_additional_service_id;
  delete from public.additional_service_expense_items where additional_service_id = p_additional_service_id;

  update public.additional_services
  set description = p_description,
      billing_type = p_billing_type,
      authorized_amount = v_amount
  where id = p_additional_service_id;

  insert into public.additional_service_labor_items (
    additional_service_id, description, hours, rate, amount, sort_order
  )
  select p_additional_service_id, description, hours, rate, amount, sort_order
  from jsonb_to_recordset(coalesce(p_labor_items, '[]'::jsonb)) as item(
    description text, hours numeric, rate numeric, amount numeric, sort_order integer
  );

  insert into public.additional_service_expense_items (
    additional_service_id, category, description, estimated_quantity, unit,
    estimated_rate, estimated_amount, billing_rule, markup_percent, requires_receipt, sort_order
  )
  select p_additional_service_id, category, description, estimated_quantity, unit,
    estimated_rate, estimated_amount, billing_rule, markup_percent, requires_receipt, sort_order
  from jsonb_to_recordset(coalesce(p_expense_items, '[]'::jsonb)) as item(
    category text, description text, estimated_quantity numeric, unit text,
    estimated_rate numeric, estimated_amount numeric, billing_rule text,
    markup_percent numeric, requires_receipt boolean, sort_order integer
  );

  return p_additional_service_id;
end;
$$;

revoke all on function public.create_additional_service_draft(uuid,text,text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.update_additional_service_draft(uuid,text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_additional_service_draft(uuid,text,text,jsonb,jsonb) to service_role;
grant execute on function public.update_additional_service_draft(uuid,text,text,jsonb,jsonb) to service_role;

alter table public.time_entries
  add column if not exists source_additional_service_labor_item_id uuid;

alter table public.expenses
  add column if not exists source_additional_service_expense_item_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'time_entries_source_additional_service_labor_fk'
      and conrelid = 'public.time_entries'::regclass
  ) then
    alter table public.time_entries
      add constraint time_entries_source_additional_service_labor_fk
      foreign key (source_additional_service_labor_item_id)
      references public.additional_service_labor_items(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'expenses_source_additional_service_expense_fk'
      and conrelid = 'public.expenses'::regclass
  ) then
    alter table public.expenses
      add constraint expenses_source_additional_service_expense_fk
      foreign key (source_additional_service_expense_item_id)
      references public.additional_service_expense_items(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'time_entries_one_approved_source'
      and conrelid = 'public.time_entries'::regclass
  ) then
    alter table public.time_entries
      add constraint time_entries_one_approved_source
      check (not (source_fee_item_id is not null and source_additional_service_labor_item_id is not null));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'expenses_one_approved_source'
      and conrelid = 'public.expenses'::regclass
  ) then
    alter table public.expenses
      add constraint expenses_one_approved_source
      check (not (source_estimate_id is not null and source_additional_service_expense_item_id is not null));
  end if;
end;
$$;

create index if not exists time_entries_source_additional_service_labor_idx
  on public.time_entries(source_additional_service_labor_item_id);

create index if not exists expenses_source_additional_service_expense_idx
  on public.expenses(source_additional_service_expense_item_id);

create or replace function public.validate_time_entry_approved_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_fee_item_id is not null and not exists (
    select 1
    from public.projects p
    join public.proposal_fee_items item on item.proposal_revision_id = p.source_revision_id
    where p.id = new.project_id and item.id = new.source_fee_item_id
  ) then
    raise exception 'The selected labor category is not part of the accepted proposal.';
  end if;

  if new.source_additional_service_labor_item_id is not null and not exists (
    select 1
    from public.additional_service_labor_items item
    join public.additional_services a on a.id = item.additional_service_id
    where item.id = new.source_additional_service_labor_item_id
      and a.project_id = new.project_id
      and a.status = 'accepted'
  ) then
    raise exception 'The selected labor category is not part of an accepted Additional Service.';
  end if;

  return new;
end;
$$;

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

revoke all on function public.validate_time_entry_approved_source() from public, anon, authenticated;
revoke all on function public.validate_expense_approved_source() from public, anon, authenticated;

drop trigger if exists time_entries_validate_approved_source on public.time_entries;
create trigger time_entries_validate_approved_source
before insert or update of project_id, source_fee_item_id, source_additional_service_labor_item_id
on public.time_entries
for each row execute function public.validate_time_entry_approved_source();

drop trigger if exists expenses_validate_approved_source on public.expenses;
create trigger expenses_validate_approved_source
before insert or update of project_id, source_estimate_id, source_additional_service_expense_item_id
on public.expenses
for each row execute function public.validate_expense_approved_source();

create or replace function public.build_invoice_from_unbilled(p_invoice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_group record;
  v_expense record;
  v_item_id uuid;
  v_sort integer;
  v_time_count integer := 0;
  v_expense_count integer := 0;
begin
  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found.';
  end if;
  if v_invoice.status <> 'draft' or v_invoice.locked then
    raise exception 'Only an unlocked draft invoice can add unbilled work.';
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_sort
  from public.invoice_items
  where invoice_id = p_invoice_id;

  perform id
  from public.time_entries
  where project_id = v_invoice.project_id
    and billable = true
    and hours > 0
    and invoice_item_id is null
    and locked = false
  for update;

  for v_group in
    select
      t.source_fee_item_id,
      t.source_additional_service_labor_item_id,
      t.activity_type,
      t.billing_rate,
      t.is_travel_time,
      sum(t.hours) as hours,
      count(*)::integer as entry_count,
      max(a.authorization_number) as authorization_number
    from public.time_entries t
    left join public.additional_service_labor_items asi
      on asi.id = t.source_additional_service_labor_item_id
    left join public.additional_services a
      on a.id = asi.additional_service_id
    where t.project_id = v_invoice.project_id
      and t.billable = true
      and t.hours > 0
      and t.invoice_item_id is null
      and t.locked = false
    group by t.source_fee_item_id, t.source_additional_service_labor_item_id,
      t.activity_type, t.billing_rate, t.is_travel_time
    order by min(t.work_date), t.activity_type
  loop
    insert into public.invoice_items (
      invoice_id, item_type, description, quantity, rate, amount, sort_order
    ) values (
      p_invoice_id,
      case when v_group.is_travel_time then 'travel_time' else 'hourly' end,
      case
        when v_group.authorization_number is not null
          then v_group.authorization_number || ' — ' || v_group.activity_type
        when v_group.source_fee_item_id is not null
          then 'Original Proposal — ' || v_group.activity_type
        else 'Project Time — ' || v_group.activity_type
      end,
      v_group.hours,
      v_group.billing_rate,
      round(v_group.hours * v_group.billing_rate, 2),
      v_sort
    ) returning id into v_item_id;

    update public.time_entries
    set invoice_item_id = v_item_id
    where project_id = v_invoice.project_id
      and billable = true
      and hours > 0
      and invoice_item_id is null
      and locked = false
      and source_fee_item_id is not distinct from v_group.source_fee_item_id
      and source_additional_service_labor_item_id is not distinct from v_group.source_additional_service_labor_item_id
      and activity_type = v_group.activity_type
      and billing_rate = v_group.billing_rate
      and is_travel_time = v_group.is_travel_time;

    v_sort := v_sort + 1;
    v_time_count := v_time_count + v_group.entry_count;
  end loop;

  perform id
  from public.expenses
  where project_id = v_invoice.project_id
    and billable = true
    and billable_amount > 0
    and invoice_item_id is null
    and locked = false
  for update;

  for v_expense in
    select e.*, a.authorization_number
    from public.expenses e
    left join public.additional_service_expense_items asi
      on asi.id = e.source_additional_service_expense_item_id
    left join public.additional_services a
      on a.id = asi.additional_service_id
    where e.project_id = v_invoice.project_id
      and e.billable = true
      and e.billable_amount > 0
      and e.invoice_item_id is null
      and e.locked = false
    order by e.expense_date, e.created_at
  loop
    insert into public.invoice_items (
      invoice_id, item_type, description, quantity, rate, amount, sort_order
    ) values (
      p_invoice_id,
      'expense',
      case
        when v_expense.authorization_number is not null
          then v_expense.authorization_number || ' — ' || v_expense.category
        when v_expense.source_estimate_id is not null
          then 'Original Proposal — ' || v_expense.category
        else 'Project Expense — ' || v_expense.category
      end || coalesce(' — ' || nullif(v_expense.description, ''), ''),
      1,
      v_expense.billable_amount,
      v_expense.billable_amount,
      v_sort
    ) returning id into v_item_id;

    update public.expenses
    set invoice_item_id = v_item_id
    where id = v_expense.id;

    v_sort := v_sort + 1;
    v_expense_count := v_expense_count + 1;
  end loop;

  perform public.recalculate_invoice(p_invoice_id);

  return jsonb_build_object(
    'time_entries', v_time_count,
    'expense_entries', v_expense_count
  );
end;
$$;

revoke all on function public.build_invoice_from_unbilled(uuid) from public, anon, authenticated;
grant execute on function public.build_invoice_from_unbilled(uuid) to service_role;
