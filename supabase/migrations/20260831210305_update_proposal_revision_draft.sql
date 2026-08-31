create or replace function public.update_proposal_revision_draft(
  p_revision_id uuid,
  p_payment_terms text,
  p_validity_days integer,
  p_billing_method text,
  p_fee_items jsonb,
  p_expense_items jsonb
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
begin
  select *
  into v_revision
  from public.proposal_revisions
  where id = p_revision_id
  for update;

  if not found then
    raise exception 'Proposal revision not found.';
  end if;

  if v_revision.locked then
    raise exception 'Accepted proposal revisions are locked and cannot be edited.';
  end if;

  if p_payment_terms not in ('NET 15', 'NET 30', 'NET 90') then
    raise exception 'Payment terms are invalid.';
  end if;

  if p_validity_days is null or p_validity_days < 1 then
    raise exception 'Validity days must be at least 1.';
  end if;

  if coalesce(jsonb_typeof(p_fee_items), 'null') <> 'array'
     or coalesce(jsonb_typeof(p_expense_items), 'null') <> 'array' then
    raise exception 'Proposal line items must be arrays.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_fee_items) as fee(
      description text,
      quantity numeric,
      rate numeric,
      sort_order integer
    )
    where nullif(btrim(fee.description), '') is null
       or fee.quantity is null
       or fee.quantity < 0
       or fee.rate is null
       or fee.rate < 0
  ) then
    raise exception 'Labor lines contain invalid values.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_expense_items) as expense(
      category text,
      description text,
      estimated_quantity numeric,
      unit text,
      estimated_rate numeric,
      billing_rule text,
      markup_percent numeric,
      requires_receipt boolean,
      sort_order integer
    )
    where nullif(btrim(expense.category), '') is null
       or expense.estimated_quantity is null
       or expense.estimated_quantity < 0
       or expense.estimated_rate is null
       or expense.estimated_rate < 0
       or expense.markup_percent is null
       or expense.markup_percent < 0
       or expense.markup_percent > 999.999
       or expense.billing_rule not in (
         'actual', 'actual_plus_markup', 'fixed_rate', 'per_diem',
         'mileage', 'allowance', 'included', 'not_billable'
       )
  ) then
    raise exception 'Expense lines contain invalid values.';
  end if;

  delete from public.proposal_fee_items
  where proposal_revision_id = p_revision_id;

  insert into public.proposal_fee_items (
    proposal_revision_id,
    description,
    billing_type,
    quantity,
    rate,
    amount,
    sort_order
  )
  select
    p_revision_id,
    btrim(fee.description),
    'hourly',
    fee.quantity,
    fee.rate,
    round(fee.quantity * fee.rate, 2),
    coalesce(fee.sort_order, 0)
  from jsonb_to_recordset(p_fee_items) as fee(
    description text,
    quantity numeric,
    rate numeric,
    sort_order integer
  );

  delete from public.proposal_expense_estimates
  where proposal_revision_id = p_revision_id;

  insert into public.proposal_expense_estimates (
    proposal_revision_id,
    category,
    description,
    estimated_quantity,
    unit,
    estimated_rate,
    estimated_amount,
    billing_rule,
    markup_percent,
    requires_receipt,
    sort_order
  )
  select
    p_revision_id,
    btrim(expense.category),
    nullif(btrim(expense.description), ''),
    expense.estimated_quantity,
    nullif(btrim(expense.unit), ''),
    expense.estimated_rate,
    case
      when expense.billing_rule in ('included', 'not_billable') then 0
      when expense.billing_rule = 'actual_plus_markup' then
        round(expense.estimated_quantity * expense.estimated_rate * (1 + expense.markup_percent / 100), 2)
      else round(expense.estimated_quantity * expense.estimated_rate, 2)
    end,
    expense.billing_rule,
    case when expense.billing_rule = 'actual_plus_markup' then expense.markup_percent else 0 end,
    coalesce(expense.requires_receipt, false),
    coalesce(expense.sort_order, 0)
  from jsonb_to_recordset(p_expense_items) as expense(
    category text,
    description text,
    estimated_quantity numeric,
    unit text,
    estimated_rate numeric,
    billing_rule text,
    markup_percent numeric,
    requires_receipt boolean,
    sort_order integer
  );

  select coalesce(sum(amount), 0)
  into v_professional_fee
  from public.proposal_fee_items
  where proposal_revision_id = p_revision_id;

  select coalesce(sum(estimated_amount), 0)
  into v_estimated_expenses
  from public.proposal_expense_estimates
  where proposal_revision_id = p_revision_id;

  update public.proposal_revisions
  set professional_fee = v_professional_fee,
      estimated_expenses = v_estimated_expenses,
      billing_method = nullif(btrim(p_billing_method), ''),
      payment_terms = p_payment_terms,
      validity_days = p_validity_days
  where id = p_revision_id;

  return v_revision.proposal_id;
end;
$$;

revoke execute on function public.update_proposal_revision_draft(
  uuid, text, integer, text, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.update_proposal_revision_draft(
  uuid, text, integer, text, jsonb, jsonb
) to service_role;
