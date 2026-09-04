-- Store a configurable company default and snapshot the exact legal terms on
-- each proposal revision. Existing locked revisions remain null because those
-- terms were not part of the agreement originally sent to the customer.

alter table public.company_settings
  add column if not exists default_proposal_terms text;

alter table public.company_settings
  add constraint company_settings_proposal_terms_length
  check (
    default_proposal_terms is null
    or char_length(btrim(default_proposal_terms)) between 1 and 50000
  );

alter table public.proposal_revisions
  add column if not exists proposal_terms text;

alter table public.proposal_revisions
  add constraint proposal_revisions_terms_length
  check (
    proposal_terms is null
    or char_length(btrim(proposal_terms)) between 1 and 50000
  );

create or replace function public.update_proposal_revision_draft_v4(
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
begin
  if nullif(btrim(p_proposal_terms), '') is null then
    raise exception 'Proposal terms and conditions are required.';
  end if;

  if char_length(btrim(p_proposal_terms)) > 50000 then
    raise exception 'Proposal terms and conditions cannot exceed 50,000 characters.';
  end if;

  v_proposal_id := public.update_proposal_revision_draft_v3(
    p_revision_id,
    p_payment_terms,
    p_validity_days,
    p_billing_method,
    p_sections,
    p_fee_items,
    p_expense_items,
    p_material_items
  );

  update public.proposal_revisions
  set proposal_terms = btrim(p_proposal_terms)
  where id = p_revision_id
    and locked = false;

  if not found then
    raise exception 'The proposal revision changed before its terms could be saved.';
  end if;

  return v_proposal_id;
end;
$$;

revoke all on function public.update_proposal_revision_draft_v4(
  uuid, text, integer, text, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.update_proposal_revision_draft_v4(
  uuid, text, integer, text, text, jsonb, jsonb, jsonb, jsonb
) to service_role;
