-- Customer-selectable proposal alternates and immutable executed-contract snapshots.

create table public.proposal_alternates (
  id uuid primary key default gen_random_uuid(),
  proposal_revision_id uuid not null references public.proposal_revisions(id) on delete cascade,
  alternate_key text not null check (alternate_key ~ '^[A-Za-z0-9_-]{1,80}$'),
  title text not null check (nullif(btrim(title), '') is not null),
  description text,
  alternate_type text not null default 'independent'
    check (alternate_type in ('independent', 'dependent', 'bundle')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  required_alternate_key text,
  bundle_component_keys text[] not null default array[]::text[],
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (proposal_revision_id, alternate_key),
  check (
    (alternate_type = 'independent'
      and required_alternate_key is null
      and cardinality(bundle_component_keys) = 0)
    or (alternate_type = 'dependent'
      and nullif(btrim(required_alternate_key), '') is not null
      and cardinality(bundle_component_keys) = 0)
    or (alternate_type = 'bundle'
      and required_alternate_key is null
      and cardinality(bundle_component_keys) > 0)
  )
);

create index proposal_alternates_revision_order_idx
on public.proposal_alternates(proposal_revision_id, sort_order);

create trigger proposal_alternates_no_changes_when_locked
before insert or update or delete on public.proposal_alternates
for each row execute function public.prevent_locked_revision_item_changes();

alter table public.proposal_alternates enable row level security;

grant select, insert, update, delete on table public.proposal_alternates
  to authenticated, service_role;

create policy "proposal alternates read internal"
on public.proposal_alternates for select to authenticated
using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));

create policy "proposal alternates write authorized"
on public.proposal_alternates for all to authenticated
using (private.has_role(array['owner_admin','project_manager']))
with check (private.has_role(array['owner_admin','project_manager']));

alter table public.proposal_acceptances
  add column acceptance_version_id text,
  add column accepted_total numeric(12,2),
  add column selected_alternate_keys text[] not null default array[]::text[],
  add column accepted_snapshot jsonb;

create unique index proposal_acceptances_version_id_idx
on public.proposal_acceptances(acceptance_version_id)
where acceptance_version_id is not null;

alter table public.generated_documents
  add column acceptance_id uuid references public.proposal_acceptances(id) on delete restrict;

create unique index generated_documents_acceptance_idx
on public.generated_documents(acceptance_id)
where acceptance_id is not null;

create or replace function public.prevent_executed_contract_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'proposal_acceptances'
    and old.acceptance_version_id is not null then
    raise exception 'Accepted proposal snapshots cannot be modified or deleted.';
  end if;
  if tg_table_name = 'generated_documents'
    and old.locked = true then
    raise exception 'Locked generated documents cannot be modified or deleted.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.prevent_executed_contract_changes()
from public, anon, authenticated;

create trigger accepted_proposal_snapshot_no_changes
before update or delete on public.proposal_acceptances
for each row execute function public.prevent_executed_contract_changes();

create trigger locked_generated_document_no_changes
before update or delete on public.generated_documents
for each row execute function public.prevent_executed_contract_changes();

create or replace function public.update_proposal_revision_draft_v6(
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
  if coalesce(jsonb_typeof(p_alternates), 'null') <> 'array' then
    raise exception 'Proposal alternates must be an array.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_alternates) as alternate(
      alternate_key text, title text, description text, alternate_type text,
      amount numeric, required_alternate_key text, bundle_component_keys text[], sort_order integer
    )
    where alternate.alternate_key !~ '^[A-Za-z0-9_-]{1,80}$'
       or nullif(btrim(alternate.title), '') is null
       or alternate.alternate_type not in ('independent', 'dependent', 'bundle')
       or alternate.amount is null or alternate.amount < 0
       or (alternate.alternate_type = 'independent' and (
         alternate.required_alternate_key is not null
         or coalesce(cardinality(alternate.bundle_component_keys), 0) <> 0
       ))
       or (alternate.alternate_type = 'dependent' and (
         nullif(btrim(alternate.required_alternate_key), '') is null
         or coalesce(cardinality(alternate.bundle_component_keys), 0) <> 0
       ))
       or (alternate.alternate_type = 'bundle' and (
         alternate.required_alternate_key is not null
         or coalesce(cardinality(alternate.bundle_component_keys), 0) = 0
       ))
  ) then
    raise exception 'Proposal alternates contain invalid values.';
  end if;

  if exists (
    select alternate.alternate_key
    from jsonb_to_recordset(p_alternates) as alternate(alternate_key text)
    group by alternate.alternate_key
    having count(*) > 1
  ) then
    raise exception 'Proposal alternate keys must be unique.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_alternates) as dependent(
      alternate_key text, alternate_type text, required_alternate_key text
    )
    left join jsonb_to_recordset(p_alternates) as required_alternate(
      alternate_key text, alternate_type text
    ) on required_alternate.alternate_key = dependent.required_alternate_key
    where dependent.alternate_type = 'dependent'
      and (required_alternate.alternate_key is null
        or required_alternate.alternate_type <> 'independent'
        or dependent.alternate_key = dependent.required_alternate_key)
  ) then
    raise exception 'Dependent alternates must require another independent alternate.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_alternates) as bundle(
      alternate_key text, alternate_type text, bundle_component_keys text[]
    )
    cross join lateral unnest(bundle.bundle_component_keys) as component_key
    left join jsonb_to_recordset(p_alternates) as component(
      alternate_key text, alternate_type text
    ) on component.alternate_key = component_key
    where bundle.alternate_type = 'bundle'
      and (component.alternate_key is null
        or component.alternate_type = 'bundle'
        or component.alternate_key = bundle.alternate_key)
  ) then
    raise exception 'Bundle alternates must contain valid non-bundle components.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_alternates) as bundle(
      alternate_type text, bundle_component_keys text[]
    )
    where bundle.alternate_type = 'bundle'
      and cardinality(bundle.bundle_component_keys) <>
        (select count(distinct component) from unnest(bundle.bundle_component_keys) as component)
  ) then
    raise exception 'Bundle alternate components must be unique.';
  end if;

  v_proposal_id := public.update_proposal_revision_draft_v5(
    p_revision_id, p_payment_terms, p_validity_days, p_billing_method,
    p_proposal_terms, p_sections, p_fee_items, p_expense_items, p_material_items
  );

  delete from public.proposal_alternates
  where proposal_revision_id = p_revision_id;

  insert into public.proposal_alternates(
    proposal_revision_id, alternate_key, title, description, alternate_type,
    amount, required_alternate_key, bundle_component_keys, sort_order
  )
  select
    p_revision_id,
    alternate.alternate_key,
    btrim(alternate.title),
    nullif(btrim(alternate.description), ''),
    alternate.alternate_type,
    round(alternate.amount, 2),
    nullif(btrim(alternate.required_alternate_key), ''),
    coalesce(alternate.bundle_component_keys, array[]::text[]),
    coalesce(alternate.sort_order, 0)
  from jsonb_to_recordset(p_alternates) as alternate(
    alternate_key text, title text, description text, alternate_type text,
    amount numeric, required_alternate_key text, bundle_component_keys text[], sort_order integer
  );

  return v_proposal_id;
end;
$$;

revoke all on function public.update_proposal_revision_draft_v6(
  uuid, text, integer, text, text, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.update_proposal_revision_draft_v6(
  uuid, text, integer, text, text, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;

drop function if exists public.finalize_proposal_acceptance(
  text, text, text, text, text, text, text, text, text, text, text
);

create or replace function public.finalize_proposal_acceptance(
  p_token_hash text,
  p_acceptance_id uuid,
  p_acceptance_version_id text,
  p_accepted_at timestamptz,
  p_selected_alternate_keys text[],
  p_signer_name text,
  p_signer_title text,
  p_signer_email text,
  p_signer_mobile text,
  p_signature_type text,
  p_acceptance_statement text,
  p_ip_address text,
  p_user_agent text,
  p_executed_pdf_path text,
  p_document_hash text,
  p_original_filename text,
  p_file_size bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.proposal_share_links%rowtype;
  v_revision public.proposal_revisions%rowtype;
  v_proposal public.proposals%rowtype;
  v_project_id uuid;
  v_accepted_total numeric(12,2);
  v_snapshot jsonb;
begin
  if p_acceptance_id is null
    or nullif(btrim(p_acceptance_version_id), '') is null
    or nullif(btrim(p_signer_name), '') is null
    or nullif(btrim(p_signer_email), '') is null
    or nullif(btrim(p_executed_pdf_path), '') is null
    or nullif(btrim(p_document_hash), '') is null
    or nullif(btrim(p_original_filename), '') is null then
    raise exception 'The accepted proposal package is incomplete.';
  end if;
  if p_accepted_at is null or abs(extract(epoch from (now() - p_accepted_at))) > 600 then
    raise exception 'The acceptance timestamp is invalid.';
  end if;
  if coalesce(cardinality(p_selected_alternate_keys), 0) <>
    coalesce((select count(distinct key) from unnest(p_selected_alternate_keys) as key), 0) then
    raise exception 'An alternate was selected more than once.';
  end if;

  select * into v_link
  from public.proposal_share_links
  where token_hash = p_token_hash
  for update;
  if not found then raise exception 'Invalid proposal token.'; end if;
  if v_link.revoked_at is not null then raise exception 'Proposal link revoked.'; end if;
  if v_link.expires_at is not null and v_link.expires_at <= now() then
    raise exception 'Proposal link expired.';
  end if;
  if v_link.accepted_at is not null then raise exception 'Proposal already accepted.'; end if;

  select * into v_revision
  from public.proposal_revisions
  where id = v_link.proposal_revision_id
  for update;
  select * into v_proposal
  from public.proposals
  where id = v_revision.proposal_id
  for update;

  if v_proposal.status not in ('sent', 'viewed', 'changes_requested') then
    raise exception 'Proposal is not eligible for acceptance.';
  end if;
  if v_proposal.current_revision <> v_revision.revision_number then
    raise exception 'Only the current proposal version can be accepted.';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_selected_alternate_keys, array[]::text[])) as selected_key
    left join public.proposal_alternates alternate
      on alternate.proposal_revision_id = v_revision.id
      and alternate.alternate_key = selected_key
    where alternate.id is null
  ) then
    raise exception 'A selected alternate is not part of this proposal version.';
  end if;

  if exists (
    select 1
    from public.proposal_alternates alternate
    where alternate.proposal_revision_id = v_revision.id
      and alternate.alternate_type = 'dependent'
      and alternate.alternate_key = any(coalesce(p_selected_alternate_keys, array[]::text[]))
      and not (alternate.required_alternate_key = any(coalesce(p_selected_alternate_keys, array[]::text[])))
  ) then
    raise exception 'A dependent alternate requires another alternate that was not selected.';
  end if;

  if exists (
    select 1
    from public.proposal_alternates bundle
    where bundle.proposal_revision_id = v_revision.id
      and bundle.alternate_type = 'bundle'
      and bundle.alternate_key = any(coalesce(p_selected_alternate_keys, array[]::text[]))
      and bundle.bundle_component_keys && coalesce(p_selected_alternate_keys, array[]::text[])
  ) then
    raise exception 'A bundle cannot be selected with any of its component alternates.';
  end if;

  select round(
    v_revision.estimated_total
    + coalesce(sum(alternate.amount) filter (
      where alternate.alternate_key = any(coalesce(p_selected_alternate_keys, array[]::text[]))
    ), 0),
    2
  ) into v_accepted_total
  from public.proposal_alternates alternate
  where alternate.proposal_revision_id = v_revision.id;

  v_snapshot := jsonb_build_object(
    'schemaVersion', 1,
    'acceptanceVersionId', p_acceptance_version_id,
    'acceptedAt', p_accepted_at,
    'proposal', jsonb_build_object(
      'id', v_proposal.id,
      'proposalNumber', v_proposal.proposal_number,
      'projectName', v_proposal.project_name,
      'projectLocation', v_proposal.project_location,
      'clientId', v_proposal.client_id,
      'clientName', (select client.company_name from public.clients client where client.id = v_proposal.client_id)
    ),
    'revision', jsonb_build_object(
      'id', v_revision.id,
      'revisionNumber', v_revision.revision_number,
      'revisionDate', v_revision.revision_date,
      'professionalFee', v_revision.professional_fee,
      'estimatedMaterials', v_revision.estimated_materials,
      'estimatedExpenses', v_revision.estimated_expenses,
      'baseTotal', v_revision.estimated_total,
      'acceptedTotal', v_accepted_total,
      'billingMethod', v_revision.billing_method,
      'paymentTerms', v_revision.payment_terms,
      'validityDays', v_revision.validity_days,
      'proposalTerms', v_revision.proposal_terms
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', section.section_type,
        'heading', section.heading,
        'content', section.content,
        'sortOrder', section.sort_order
      ) order by section.sort_order)
      from public.proposal_sections section
      where section.proposal_revision_id = v_revision.id
    ), '[]'::jsonb),
    'fees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', fee.description,
        'billingType', fee.billing_type,
        'quantity', fee.quantity,
        'unit', fee.unit,
        'rate', fee.rate,
        'amount', fee.amount,
        'sortOrder', fee.sort_order
      ) order by fee.sort_order)
      from public.proposal_fee_items fee
      where fee.proposal_revision_id = v_revision.id
    ), '[]'::jsonb),
    'materials', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', material.description,
        'quantity', material.quantity,
        'unit', material.unit,
        'unitPrice', material.unit_price,
        'amount', material.amount,
        'sortOrder', material.sort_order
      ) order by material.sort_order)
      from public.proposal_material_items material
      where material.proposal_revision_id = v_revision.id
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'category', expense.category,
        'description', expense.description,
        'quantity', expense.estimated_quantity,
        'unit', expense.unit,
        'rate', expense.estimated_rate,
        'amount', expense.estimated_amount,
        'billingRule', expense.billing_rule,
        'sortOrder', expense.sort_order
      ) order by expense.sort_order)
      from public.proposal_expense_estimates expense
      where expense.proposal_revision_id = v_revision.id
    ), '[]'::jsonb),
    'alternates', jsonb_build_object(
      'selected', coalesce((
        select jsonb_agg(to_jsonb(alternate) - 'proposal_revision_id' - 'created_at' order by alternate.sort_order)
        from public.proposal_alternates alternate
        where alternate.proposal_revision_id = v_revision.id
          and alternate.alternate_key = any(coalesce(p_selected_alternate_keys, array[]::text[]))
      ), '[]'::jsonb),
      'declined', coalesce((
        select jsonb_agg(to_jsonb(alternate) - 'proposal_revision_id' - 'created_at' order by alternate.sort_order)
        from public.proposal_alternates alternate
        where alternate.proposal_revision_id = v_revision.id
          and not (alternate.alternate_key = any(coalesce(p_selected_alternate_keys, array[]::text[])))
      ), '[]'::jsonb)
    ),
    'acceptance', jsonb_build_object(
      'signerName', btrim(p_signer_name),
      'signerTitle', nullif(btrim(p_signer_title), ''),
      'signerEmail', lower(btrim(p_signer_email)),
      'signerMobile', nullif(btrim(p_signer_mobile), ''),
      'signatureType', p_signature_type,
      'acceptanceStatement', p_acceptance_statement,
      'acceptedAt', p_accepted_at
    )
  );

  insert into public.proposal_acceptances(
    id, proposal_revision_id, signer_name, signer_title, signer_email, signer_mobile,
    acceptance_statement, signature_type, accepted_at, ip_address, user_agent,
    document_hash, executed_pdf_path, acceptance_version_id, accepted_total,
    selected_alternate_keys, accepted_snapshot
  ) values (
    p_acceptance_id, v_revision.id, btrim(p_signer_name), nullif(btrim(p_signer_title), ''),
    lower(btrim(p_signer_email)), nullif(btrim(p_signer_mobile), ''),
    p_acceptance_statement, p_signature_type, p_accepted_at,
    nullif(p_ip_address, '')::inet, p_user_agent, p_document_hash,
    p_executed_pdf_path, p_acceptance_version_id, v_accepted_total,
    coalesce(p_selected_alternate_keys, array[]::text[]), v_snapshot
  );

  if not v_revision.locked then
    update public.proposal_revisions set locked = true where id = v_revision.id;
  end if;
  update public.proposals
  set status = 'accepted',
      current_revision = v_revision.revision_number,
      accepted_at = p_accepted_at
  where id = v_proposal.id;
  update public.proposal_share_links
  set accepted_at = p_accepted_at,
      revoked_at = now()
  where id = v_link.id;

  select id into v_project_id
  from public.projects
  where source_revision_id = v_revision.id
  limit 1;
  if v_project_id is null then
    insert into public.projects(
      project_number, client_id, primary_contact_id, source_proposal_id,
      source_revision_id, project_name, project_location, status, original_contract_amount
    ) values (
      v_proposal.proposal_number, v_proposal.client_id, v_proposal.primary_contact_id,
      v_proposal.id, v_revision.id, v_proposal.project_name, v_proposal.project_location,
      'active', v_accepted_total
    ) returning id into v_project_id;
  end if;

  insert into public.generated_documents(
    client_id, project_id, document_type, related_record_id, revision_number,
    storage_path, original_filename, mime_type, file_size, sha256_hash,
    locked, acceptance_id
  ) values (
    v_proposal.client_id, v_project_id, 'executed_proposal', v_proposal.id,
    v_revision.revision_number, p_executed_pdf_path, p_original_filename,
    'application/pdf', p_file_size, p_document_hash, true, p_acceptance_id
  );

  insert into public.activity_log(
    client_id, project_id, record_type, record_id, event_type, event_description,
    new_values, ip_address, user_agent
  ) values (
    v_proposal.client_id, v_project_id, 'proposal', v_proposal.id,
    'proposal.accepted',
    'Proposal accepted electronically; choices and executed contract snapshot locked.',
    jsonb_build_object(
      'revision_id', v_revision.id,
      'acceptance_id', p_acceptance_id,
      'acceptance_version_id', p_acceptance_version_id,
      'accepted_total', v_accepted_total,
      'selected_alternate_keys', coalesce(p_selected_alternate_keys, array[]::text[]),
      'document_hash', p_document_hash
    ),
    nullif(p_ip_address, '')::inet,
    p_user_agent
  );

  return jsonb_build_object(
    'projectId', v_project_id,
    'acceptanceId', p_acceptance_id,
    'acceptanceVersionId', p_acceptance_version_id,
    'acceptedAt', p_accepted_at,
    'acceptedTotal', v_accepted_total
  );
end;
$$;

revoke all on function public.finalize_proposal_acceptance(
  text, uuid, text, timestamptz, text[], text, text, text, text, text,
  text, text, text, text, text, text, bigint
) from public, anon, authenticated;
grant execute on function public.finalize_proposal_acceptance(
  text, uuid, text, timestamptz, text[], text, text, text, text, text,
  text, text, text, text, text, text, bigint
) to service_role;
