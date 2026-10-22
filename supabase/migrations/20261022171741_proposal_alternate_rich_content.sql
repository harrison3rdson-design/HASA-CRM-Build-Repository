alter table public.proposal_alternates
  add column if not exists description_json jsonb;

alter table public.proposal_alternates
  drop constraint if exists proposal_alternates_description_json_shape_check;
alter table public.proposal_alternates
  add constraint proposal_alternates_description_json_shape_check
  check (
    description_json is null
    or (
      jsonb_typeof(description_json) = 'object'
      and description_json ->> 'type' = 'doc'
      and jsonb_typeof(description_json -> 'content') = 'array'
    )
  );

comment on column public.proposal_alternates.description_json is
  'Sanitized TipTap/ProseMirror JSON for the alternate description. The description column remains the plain-text fallback.';

create or replace function public.update_proposal_revision_draft_v9(
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
  if exists (
    select 1
    from jsonb_to_recordset(p_alternates) as alternate(description_json jsonb)
    where alternate.description_json is not null
      and (
        jsonb_typeof(alternate.description_json) <> 'object'
        or alternate.description_json ->> 'type' <> 'doc'
        or jsonb_typeof(alternate.description_json -> 'content') <> 'array'
      )
  ) then
    raise exception 'A proposal alternate contains invalid formatted content.';
  end if;

  v_proposal_id := public.update_proposal_revision_draft_v8(
    p_revision_id, p_payment_terms, p_validity_days, p_billing_method,
    p_proposal_terms, p_proposal_terms_json, p_sections, p_fee_items,
    p_expense_items, p_material_items, p_alternates
  );

  update public.proposal_alternates as stored
  set description_json = incoming.description_json
  from jsonb_to_recordset(p_alternates) as incoming(
    alternate_key text,
    description_json jsonb
  )
  where stored.proposal_revision_id = p_revision_id
    and stored.alternate_key = incoming.alternate_key;

  return v_proposal_id;
end;
$$;

revoke all on function public.update_proposal_revision_draft_v9(
  uuid, text, integer, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.update_proposal_revision_draft_v9(
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
  v_alternates jsonb;
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

  select jsonb_build_object(
    'selected', coalesce(jsonb_agg(
      to_jsonb(alternate) - 'proposal_revision_id' - 'created_at'
      order by alternate.sort_order
    ) filter (
      where alternate.alternate_key = any(coalesce(new.selected_alternate_keys, array[]::text[]))
    ), '[]'::jsonb),
    'declined', coalesce(jsonb_agg(
      to_jsonb(alternate) - 'proposal_revision_id' - 'created_at'
      order by alternate.sort_order
    ) filter (
      where not (alternate.alternate_key = any(coalesce(new.selected_alternate_keys, array[]::text[])))
    ), '[]'::jsonb)
  )
  into v_alternates
  from public.proposal_alternates as alternate
  where alternate.proposal_revision_id = new.proposal_revision_id;

  new.accepted_snapshot := jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(new.accepted_snapshot, '{sections}', v_sections, true),
        '{revision,proposalTermsJson}',
        coalesce(v_proposal_terms_json, 'null'::jsonb),
        true
      ),
      '{alternates}',
      coalesce(v_alternates, jsonb_build_object('selected', '[]'::jsonb, 'declined', '[]'::jsonb)),
      true
    ),
    '{schemaVersion}',
    '4'::jsonb,
    true
  );
  return new;
end;
$$;

revoke all on function public.enrich_proposal_acceptance_snapshot_content()
from public, anon, authenticated;
