alter table public.proposal_sections
  add column if not exists content_json jsonb;

alter table public.proposal_sections
  drop constraint if exists proposal_sections_content_json_shape_check;

alter table public.proposal_sections
  add constraint proposal_sections_content_json_shape_check
  check (
    content_json is null
    or (
      jsonb_typeof(content_json) = 'object'
      and content_json ->> 'type' = 'doc'
      and jsonb_typeof(content_json -> 'content') = 'array'
    )
  );

comment on column public.proposal_sections.content_json is
  'Sanitized TipTap/ProseMirror JSON used for formatted proposal content. The content column remains the plain-text fallback.';

create or replace function public.update_proposal_revision_draft_v7(
  p_revision_id uuid,
  p_payment_terms text,
  p_validity_days integer,
  p_billing_method text,
  p_proposal_terms text,
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
    from jsonb_to_recordset(p_sections) as section(sort_order integer)
    group by coalesce(section.sort_order, 0)
    having count(*) > 1
  ) then
    raise exception 'Proposal scope sections must have a unique display order.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_sections) as section(content_json jsonb)
    where section.content_json is not null
      and (
        jsonb_typeof(section.content_json) <> 'object'
        or section.content_json ->> 'type' <> 'doc'
        or jsonb_typeof(section.content_json -> 'content') <> 'array'
      )
  ) then
    raise exception 'A proposal scope section contains invalid formatted content.';
  end if;

  v_proposal_id := public.update_proposal_revision_draft_v6(
    p_revision_id, p_payment_terms, p_validity_days, p_billing_method,
    p_proposal_terms, p_sections, p_fee_items, p_expense_items,
    p_material_items, p_alternates
  );

  update public.proposal_sections as stored
  set content_json = incoming.content_json
  from jsonb_to_recordset(p_sections) as incoming(
    content_json jsonb,
    sort_order integer
  )
  where stored.proposal_revision_id = p_revision_id
    and stored.sort_order = coalesce(incoming.sort_order, 0);

  return v_proposal_id;
end;
$$;

revoke all on function public.update_proposal_revision_draft_v7(
  uuid, text, integer, text, text, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.update_proposal_revision_draft_v7(
  uuid, text, integer, text, text, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;

create or replace function public.enrich_proposal_acceptance_snapshot_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sections jsonb;
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

  new.accepted_snapshot := jsonb_set(
    jsonb_set(new.accepted_snapshot, '{sections}', v_sections, true),
    '{schemaVersion}',
    '2'::jsonb,
    true
  );
  return new;
end;
$$;

revoke all on function public.enrich_proposal_acceptance_snapshot_content()
from public, anon, authenticated;

drop trigger if exists proposal_acceptances_enrich_snapshot_content
on public.proposal_acceptances;
create trigger proposal_acceptances_enrich_snapshot_content
before insert on public.proposal_acceptances
for each row execute function public.enrich_proposal_acceptance_snapshot_content();
