alter table public.company_settings
  add column if not exists default_proposal_terms_json jsonb;

alter table public.proposal_revisions
  add column if not exists proposal_terms_json jsonb;

alter table public.company_settings
  drop constraint if exists company_settings_default_proposal_terms_json_shape_check;
alter table public.company_settings
  add constraint company_settings_default_proposal_terms_json_shape_check
  check (
    default_proposal_terms_json is null
    or (
      jsonb_typeof(default_proposal_terms_json) = 'object'
      and default_proposal_terms_json ->> 'type' = 'doc'
      and jsonb_typeof(default_proposal_terms_json -> 'content') = 'array'
    )
  );

alter table public.proposal_revisions
  drop constraint if exists proposal_revisions_proposal_terms_json_shape_check;
alter table public.proposal_revisions
  add constraint proposal_revisions_proposal_terms_json_shape_check
  check (
    proposal_terms_json is null
    or (
      jsonb_typeof(proposal_terms_json) = 'object'
      and proposal_terms_json ->> 'type' = 'doc'
      and jsonb_typeof(proposal_terms_json -> 'content') = 'array'
    )
  );

comment on column public.company_settings.default_proposal_terms_json is
  'Sanitized TipTap/ProseMirror JSON for the default proposal terms. The text column remains the fallback.';
comment on column public.proposal_revisions.proposal_terms_json is
  'Sanitized TipTap/ProseMirror JSON for this immutable proposal version. The text column remains the fallback.';

create or replace function public.update_proposal_revision_draft_v8(
  p_revision_id uuid,
  p_payment_terms text,
  p_validity_days integer,
  p_billing_method text,
  p_proposal_terms text,
  p_proposal_terms_json jsonb,
  p_sections jsonb,
  p_fee_items jsonb,
  p_expense_items jsonb,
  p_material_items jsonb,
  p_alternates jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_proposal_id uuid;
begin
  if p_proposal_terms_json is not null and (
    jsonb_typeof(p_proposal_terms_json) <> 'object'
    or p_proposal_terms_json ->> 'type' <> 'doc'
    or jsonb_typeof(p_proposal_terms_json -> 'content') <> 'array'
  ) then
    raise exception 'The proposal terms contain invalid formatted content.';
  end if;

  v_proposal_id := public.update_proposal_revision_draft_v7(
    p_revision_id, p_payment_terms, p_validity_days, p_billing_method,
    p_proposal_terms, p_sections, p_fee_items, p_expense_items,
    p_material_items, p_alternates
  );

  update public.proposal_revisions
  set proposal_terms_json = p_proposal_terms_json
  where id = p_revision_id
    and locked = false;

  return v_proposal_id;
end;
$$;

revoke all on function public.update_proposal_revision_draft_v8(
  uuid, text, integer, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.update_proposal_revision_draft_v8(
  uuid, text, integer, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;

create or replace function public.enrich_proposal_acceptance_snapshot_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sections jsonb;
  v_proposal_terms_json jsonb;
begin
  if new.accepted_snapshot is null then
    return new;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'type', section.section_type,
    'heading', section.heading,
    'content', section.content,
    'contentJson', section.content_json,
    'sortOrder', section.sort_order
  ) order by section.sort_order), '[]'::jsonb)
  into v_sections
  from public.proposal_sections as section
  where section.proposal_revision_id = new.proposal_revision_id;

  select revision.proposal_terms_json
  into v_proposal_terms_json
  from public.proposal_revisions as revision
  where revision.id = new.proposal_revision_id;

  new.accepted_snapshot := jsonb_set(
    jsonb_set(
      jsonb_set(new.accepted_snapshot, '{sections}', v_sections, true),
      '{revision,proposalTermsJson}',
      coalesce(v_proposal_terms_json, 'null'::jsonb),
      true
    ),
    '{schemaVersion}',
    '3'::jsonb,
    true
  );
  return new;
end;
$$;

revoke all on function public.enrich_proposal_acceptance_snapshot_content()
from public, anon, authenticated;
