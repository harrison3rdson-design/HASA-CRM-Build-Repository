-- Give Advance, Progress, and Final invoices distinct, atomic billing behavior.

create or replace view public.project_invoice_context
with (security_invoker = true)
as
select
  p.id,
  p.project_number,
  p.project_name,
  p.status,
  p.source_revision_id,
  p.authorized_fee,
  p.original_contract_amount,
  coalesce(pr.billing_method, 'fixed_fee') as billing_method,
  p.original_contract_amount + coalesce((
    select sum(
      case
        when exists (
          select 1
          from public.additional_service_labor_items labor
          where labor.additional_service_id = service.id
        ) or exists (
          select 1
          from public.additional_service_expense_items expense
          where expense.additional_service_id = service.id
        ) then coalesce((
          select sum(labor.amount)
          from public.additional_service_labor_items labor
          where labor.additional_service_id = service.id
        ), 0)
        else service.authorized_amount
      end
    )
    from public.additional_services service
    where service.project_id = p.id
      and service.status = 'accepted'
  ), 0) as service_fee_authorized
from public.projects p
left join public.proposal_revisions pr on pr.id = p.source_revision_id;

grant select on public.project_invoice_context to authenticated, service_role;

create or replace function public.claim_unbilled_invoice_items(
  p_invoice_id uuid,
  p_include_time boolean,
  p_include_expenses boolean,
  p_zero_time_amount boolean default false
)
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

  if p_include_time then
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
        end || case when p_zero_time_amount then ' (included in fixed fee)' else '' end,
        v_group.hours,
        case when p_zero_time_amount then 0 else v_group.billing_rate end,
        case when p_zero_time_amount then 0 else round(v_group.hours * v_group.billing_rate, 2) end,
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
  end if;

  if p_include_expenses then
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
  end if;

  return jsonb_build_object(
    'time_entries', v_time_count,
    'expense_entries', v_expense_count
  );
end;
$$;

revoke all on function public.claim_unbilled_invoice_items(uuid, boolean, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_unbilled_invoice_items(uuid, boolean, boolean, boolean)
  to service_role;

create or replace function public.build_invoice_workflow(
  p_invoice_id uuid,
  p_include_time boolean default true,
  p_include_expenses boolean default true,
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
  v_item_count integer;
  v_total numeric(12,2);
begin
  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found.';
  end if;
  if v_invoice.status <> 'draft' or v_invoice.locked then
    raise exception 'Only an unlocked draft invoice can be built.';
  end if;
  if exists (select 1 from public.invoice_items where invoice_id = p_invoice_id) then
    raise exception 'This draft invoice already has line items.';
  end if;
  if v_invoice.invoice_type not in ('advance', 'progress', 'final') then
    raise exception 'Invoice type must be Advance, Progress, or Final.';
  end if;

  select * into v_context
  from public.project_invoice_context
  where id = v_invoice.project_id;

  if not found then
    raise exception 'Project billing context was not found.';
  end if;

  select coalesce(sum(item.amount), 0) into v_prior_service_billed
  from public.invoices prior_invoice
  join public.invoice_items item on item.invoice_id = prior_invoice.id
  where prior_invoice.project_id = v_invoice.project_id
    and prior_invoice.id <> p_invoice_id
    and prior_invoice.status <> 'void'
    and item.item_type in ('professional_fee', 'progress', 'hourly', 'travel_time', 'additional_service');

  v_remaining_service_fee := greatest(v_context.service_fee_authorized - v_prior_service_billed, 0);

  if v_invoice.invoice_type = 'advance' then
    if p_advance_method not in ('amount', 'percentage') then
      raise exception 'Choose an advance amount or percentage.';
    end if;
    if coalesce(p_advance_value, 0) <= 0 then
      raise exception 'Advance value must be greater than zero.';
    end if;

    if p_advance_method = 'percentage' then
      if p_advance_value > 100 then
        raise exception 'Advance percentage cannot exceed 100.';
      end if;
      v_advance_amount := round(v_context.service_fee_authorized * p_advance_value / 100, 2);
    else
      v_advance_amount := round(p_advance_value, 2);
    end if;

    if v_advance_amount > v_remaining_service_fee then
      raise exception 'Advance exceeds the remaining authorized service fee of %.', to_char(v_remaining_service_fee, 'FM999999990.00');
    end if;

    insert into public.invoice_items (
      invoice_id, item_type, description, quantity, rate, amount, sort_order
    ) values (
      p_invoice_id,
      'professional_fee',
      case
        when p_advance_method = 'percentage'
          then 'Advance payment (' || trim(to_char(p_advance_value, 'FM999990.###')) || '% of authorized services)'
        else 'Advance payment'
      end,
      1,
      v_advance_amount,
      v_advance_amount,
      0
    );
  elsif v_invoice.invoice_type = 'progress' then
    if not p_include_time and not p_include_expenses then
      raise exception 'Choose unbilled time, unbilled expenses, or both.';
    end if;
    v_claimed := public.claim_unbilled_invoice_items(
      p_invoice_id, p_include_time, p_include_expenses, false
    );
  else
    if v_context.billing_method in ('fixed_fee', 'milestone') then
      if v_remaining_service_fee > 0 then
        insert into public.invoice_items (
          invoice_id, item_type, description, quantity, rate, amount, sort_order
        ) values (
          p_invoice_id,
          'professional_fee',
          'Final authorized service balance',
          1,
          v_remaining_service_fee,
          v_remaining_service_fee,
          0
        );
      end if;
      v_claimed := public.claim_unbilled_invoice_items(p_invoice_id, true, true, true);
    else
      v_claimed := public.claim_unbilled_invoice_items(p_invoice_id, true, true, false);
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
    'invoice_type', v_invoice.invoice_type,
    'authorized_service_fee', v_context.service_fee_authorized,
    'prior_service_billed', v_prior_service_billed,
    'remaining_service_fee_before_invoice', v_remaining_service_fee,
    'invoice_total', v_total
  );
end;
$$;

revoke all on function public.build_invoice_workflow(uuid, boolean, boolean, text, numeric)
  from public, anon, authenticated;
grant execute on function public.build_invoice_workflow(uuid, boolean, boolean, text, numeric)
  to service_role;
