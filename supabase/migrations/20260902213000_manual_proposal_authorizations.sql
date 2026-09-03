alter table public.proposal_acceptances
  add column if not exists authorization_method text not null default 'electronic',
  add column if not exists recorded_by uuid references public.app_users(id),
  add column if not exists recorded_at timestamptz,
  add column if not exists recording_notes text,
  add column if not exists evidence_document_id uuid references public.documents(id) on delete restrict;

alter table public.proposal_acceptances
  drop constraint if exists proposal_acceptances_authorization_method_check;

alter table public.proposal_acceptances
  add constraint proposal_acceptances_authorization_method_check
  check (authorization_method in ('electronic', 'verbal', 'email'));

create index if not exists proposal_acceptances_evidence_document_idx
on public.proposal_acceptances(evidence_document_id)
where evidence_document_id is not null;

create or replace function public.record_manual_proposal_acceptance(
  p_revision_id uuid,
  p_signer_name text,
  p_signer_title text,
  p_signer_email text,
  p_signer_mobile text,
  p_authorization_method text,
  p_authorized_at timestamptz,
  p_recording_notes text,
  p_evidence_document_id uuid,
  p_recorded_by uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_revision public.proposal_revisions%rowtype;
  v_proposal public.proposals%rowtype;
  v_recorder public.app_users%rowtype;
  v_evidence public.documents%rowtype;
  v_acceptance_id uuid;
  v_project_id uuid;
  v_statement text;
begin
  if p_authorization_method not in ('verbal', 'email') then
    raise exception 'Manual authorization method must be verbal or email.';
  end if;

  if nullif(btrim(p_signer_name), '') is null then
    raise exception 'Customer name is required.';
  end if;

  if p_authorized_at is null then
    raise exception 'Authorization date and time are required.';
  end if;

  if p_authorized_at > now() + interval '5 minutes' then
    raise exception 'Authorization date and time cannot be in the future.';
  end if;

  if nullif(btrim(p_recording_notes), '') is null then
    raise exception 'Authorization notes are required.';
  end if;

  if char_length(p_recording_notes) > 4000 then
    raise exception 'Authorization notes cannot exceed 4,000 characters.';
  end if;

  select * into v_recorder
  from public.app_users
  where id = p_recorded_by
    and active = true
    and role in ('owner_admin', 'project_manager');

  if not found then
    raise exception 'An active owner or project manager must record the authorization.';
  end if;

  select * into v_revision
  from public.proposal_revisions
  where id = p_revision_id
  for update;

  if not found then
    raise exception 'Proposal revision not found.';
  end if;

  select * into v_proposal
  from public.proposals
  where id = v_revision.proposal_id
  for update;

  if v_proposal.current_revision <> v_revision.revision_number then
    raise exception 'Only the current proposal version can be authorized.';
  end if;

  if v_proposal.status not in ('sent', 'viewed', 'changes_requested') or not v_revision.locked then
    raise exception 'Only a sent and locked proposal version can be manually authorized.';
  end if;

  if exists (
    select 1 from public.proposal_acceptances
    where proposal_revision_id = v_revision.id
  ) then
    raise exception 'This proposal version already has an authorization record.';
  end if;

  if p_authorized_at < v_revision.created_at then
    raise exception 'Authorization date and time cannot be earlier than the proposal version.';
  end if;

  if p_authorization_method = 'email' and p_evidence_document_id is null then
    raise exception 'Email authorization evidence is required.';
  end if;

  if p_evidence_document_id is not null then
    select * into v_evidence
    from public.documents
    where id = p_evidence_document_id
    for update;

    if not found
      or v_evidence.client_id is distinct from v_proposal.client_id
      or v_evidence.related_record_type is distinct from 'proposal'
      or v_evidence.related_record_id is distinct from v_proposal.id
      or v_evidence.document_type is distinct from 'proposal_authorization_evidence'
      or v_evidence.locked is distinct from true then
      raise exception 'Authorization evidence is not linked to this proposal.';
    end if;
  end if;

  v_statement := case p_authorization_method
    when 'email' then 'Authorization received by email and recorded by HASA Concepts.'
    else 'Verbal authorization received and recorded by HASA Concepts.'
  end;

  insert into public.proposal_acceptances(
    proposal_revision_id,
    signer_name,
    signer_title,
    signer_email,
    signer_mobile,
    acceptance_statement,
    signature_type,
    accepted_at,
    authorization_method,
    recorded_by,
    recorded_at,
    recording_notes,
    evidence_document_id
  ) values (
    v_revision.id,
    btrim(p_signer_name),
    nullif(btrim(p_signer_title), ''),
    nullif(btrim(p_signer_email), ''),
    nullif(btrim(p_signer_mobile), ''),
    v_statement,
    'none',
    p_authorized_at,
    p_authorization_method,
    v_recorder.id,
    now(),
    btrim(p_recording_notes),
    p_evidence_document_id
  )
  returning id into v_acceptance_id;

  update public.proposals
  set status = 'accepted',
      current_revision = v_revision.revision_number,
      accepted_at = p_authorized_at
  where id = v_proposal.id;

  update public.proposal_share_links
  set accepted_at = coalesce(accepted_at, p_authorized_at),
      revoked_at = coalesce(revoked_at, now())
  where proposal_revision_id = v_revision.id;

  select id into v_project_id
  from public.projects
  where source_revision_id = v_revision.id
  limit 1;

  if v_project_id is null then
    insert into public.projects(
      project_number,
      client_id,
      primary_contact_id,
      source_proposal_id,
      source_revision_id,
      project_name,
      project_location,
      status,
      original_contract_amount
    ) values (
      v_proposal.proposal_number,
      v_proposal.client_id,
      v_proposal.primary_contact_id,
      v_proposal.id,
      v_revision.id,
      v_proposal.project_name,
      v_proposal.project_location,
      'active',
      v_revision.professional_fee
    )
    returning id into v_project_id;
  end if;

  if p_evidence_document_id is not null then
    update public.documents
    set project_id = v_project_id
    where id = p_evidence_document_id;
  end if;

  insert into public.activity_log(
    user_id,
    client_id,
    project_id,
    record_type,
    record_id,
    event_type,
    event_description,
    new_values
  ) values (
    v_recorder.id,
    v_proposal.client_id,
    v_project_id,
    'proposal',
    v_proposal.id,
    'proposal.manually_accepted',
    'Proposal authorization recorded manually and project created/confirmed.',
    jsonb_build_object(
      'revision_id', v_revision.id,
      'acceptance_id', v_acceptance_id,
      'authorization_method', p_authorization_method,
      'authorized_at', p_authorized_at,
      'signer_name', btrim(p_signer_name),
      'evidence_document_id', p_evidence_document_id
    )
  );

  return v_project_id;
end;
$$;

revoke execute on function public.record_manual_proposal_acceptance(
  uuid, text, text, text, text, text, timestamptz, text, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.record_manual_proposal_acceptance(
  uuid, text, text, text, text, text, timestamptz, text, uuid, uuid
) to service_role;
