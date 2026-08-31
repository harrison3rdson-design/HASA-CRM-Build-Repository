-- HASA Concepts Release 1 / Corrected Phase 8 acceptance + delivery
-- Corrected for compatibility with Phases 1-4 schema.

alter table public.proposal_share_links
  add column if not exists accepted_at timestamptz,
  add column if not exists last_delivery_at timestamptz;

alter table public.additional_service_share_links
  add column if not exists accepted_at timestamptz,
  add column if not exists last_delivery_at timestamptz;

create or replace function public.register_proposal_view(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_link public.proposal_share_links%rowtype;
begin
  select * into v_link from public.proposal_share_links where token_hash=p_token_hash for update;
  if not found then raise exception 'Invalid proposal link.'; end if;
  if v_link.revoked_at is not null then raise exception 'Proposal link has been revoked.'; end if;
  if v_link.expires_at is not null and v_link.expires_at < now() then raise exception 'Proposal link has expired.'; end if;

  update public.proposal_share_links
  set first_viewed_at=coalesce(first_viewed_at,now()),last_viewed_at=now(),view_count=view_count+1
  where id=v_link.id;

  update public.proposals p
  set status=case when p.status='sent' then 'viewed' else p.status end
  from public.proposal_revisions r
  where r.id=v_link.proposal_revision_id and p.id=r.proposal_id;

  return v_link.proposal_revision_id;
end;
$$;

create or replace function public.register_additional_service_view(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_link public.additional_service_share_links%rowtype;
begin
  select * into v_link from public.additional_service_share_links where token_hash=p_token_hash for update;
  if not found then raise exception 'Invalid authorization link.'; end if;
  if v_link.revoked_at is not null then raise exception 'Authorization link has been revoked.'; end if;
  if v_link.expires_at is not null and v_link.expires_at < now() then raise exception 'Authorization link has expired.'; end if;

  update public.additional_service_share_links
  set first_viewed_at=coalesce(first_viewed_at,now()),last_viewed_at=now(),view_count=view_count+1
  where id=v_link.id;

  update public.additional_services
  set status=case when status='sent' then 'viewed' else status end
  where id=v_link.additional_service_id;

  return v_link.additional_service_id;
end;
$$;

create or replace function public.finalize_proposal_acceptance(
  p_token_hash text,p_signer_name text,p_signer_title text,p_signer_email text,p_signer_mobile text,
  p_signature_type text,p_acceptance_statement text,p_ip_address text,p_user_agent text,
  p_executed_pdf_path text,p_document_hash text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_link public.proposal_share_links%rowtype;
  v_revision public.proposal_revisions%rowtype;
  v_proposal public.proposals%rowtype;
  v_acceptance_id uuid;
  v_project_id uuid;
begin
  select * into v_link from public.proposal_share_links where token_hash=p_token_hash for update;
  if not found then raise exception 'Invalid proposal token.'; end if;
  if v_link.revoked_at is not null then raise exception 'Proposal link revoked.'; end if;
  if v_link.expires_at is not null and v_link.expires_at<=now() then raise exception 'Proposal link expired.'; end if;
  if v_link.accepted_at is not null then raise exception 'Proposal already accepted.'; end if;

  select * into v_revision from public.proposal_revisions where id=v_link.proposal_revision_id for update;
  select * into v_proposal from public.proposals where id=v_revision.proposal_id for update;

  if v_revision.locked then raise exception 'Proposal revision already locked.'; end if;

  insert into public.proposal_acceptances(
    proposal_revision_id,signer_name,signer_title,signer_email,signer_mobile,
    acceptance_statement,signature_type,accepted_at,ip_address,user_agent,executed_pdf_path,document_hash
  ) values (
    v_revision.id,p_signer_name,p_signer_title,p_signer_email,p_signer_mobile,
    p_acceptance_statement,p_signature_type,now(),nullif(p_ip_address,'')::inet,p_user_agent,p_executed_pdf_path,p_document_hash
  ) returning id into v_acceptance_id;

  update public.proposal_revisions set locked=true where id=v_revision.id;
  update public.proposals
    set status='accepted',current_revision=v_revision.revision_number,accepted_at=now()
    where id=v_proposal.id;
  update public.proposal_share_links set accepted_at=now(),revoked_at=now() where id=v_link.id;

  select id into v_project_id from public.projects where source_revision_id=v_revision.id limit 1;
  if v_project_id is null then
    insert into public.projects(
      project_number,client_id,primary_contact_id,source_proposal_id,source_revision_id,
      project_name,project_location,status,original_contract_amount
    ) values (
      v_proposal.proposal_number,v_proposal.client_id,v_proposal.primary_contact_id,
      v_proposal.id,v_revision.id,v_proposal.project_name,v_proposal.project_location,
      'active',v_revision.professional_fee
    ) returning id into v_project_id;
  end if;

  insert into public.activity_log(
    client_id,project_id,record_type,record_id,event_type,event_description,new_values,
    ip_address,user_agent
  ) values (
    v_proposal.client_id,v_project_id,'proposal',v_proposal.id,'proposal.accepted',
    'Proposal accepted electronically and project created/confirmed.',
    jsonb_build_object('revision_id',v_revision.id,'acceptance_id',v_acceptance_id,'document_hash',p_document_hash),
    nullif(p_ip_address,'')::inet,p_user_agent
  );

  return v_project_id;
end;
$$;

create or replace function public.finalize_additional_service_acceptance(
  p_token_hash text,p_signer_name text,p_signer_title text,p_signer_email text,p_signer_mobile text,
  p_signature_type text,p_acceptance_statement text,p_ip_address text,p_user_agent text,
  p_executed_pdf_path text,p_document_hash text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_link public.additional_service_share_links%rowtype;
  v_auth public.additional_services%rowtype;
  v_acceptance_id uuid;
begin
  select * into v_link from public.additional_service_share_links where token_hash=p_token_hash for update;
  if not found then raise exception 'Invalid authorization token.'; end if;
  if v_link.revoked_at is not null then raise exception 'Authorization link revoked.'; end if;
  if v_link.expires_at is not null and v_link.expires_at<=now() then raise exception 'Authorization link expired.'; end if;
  if v_link.accepted_at is not null then raise exception 'Authorization already accepted.'; end if;

  select * into v_auth from public.additional_services where id=v_link.additional_service_id for update;

  insert into public.additional_service_acceptances(
    additional_service_id,signer_name,signer_title,signer_email,signer_mobile,
    acceptance_statement,signature_type,accepted_at,ip_address,user_agent,executed_pdf_path,document_hash
  ) values (
    v_auth.id,p_signer_name,p_signer_title,p_signer_email,p_signer_mobile,
    p_acceptance_statement,p_signature_type,now(),nullif(p_ip_address,'')::inet,p_user_agent,p_executed_pdf_path,p_document_hash
  ) returning id into v_acceptance_id;

  update public.additional_services
  set status='accepted',accepted_at=now(),executed_pdf_path=p_executed_pdf_path,document_hash=p_document_hash,locked=true
  where id=v_auth.id;

  update public.additional_service_share_links set accepted_at=now(),revoked_at=now() where id=v_link.id;

  update public.projects
  set additional_services_amount=additional_services_amount+v_auth.authorized_amount
  where id=v_auth.project_id;

  insert into public.activity_log(
    project_id,record_type,record_id,event_type,event_description,new_values,ip_address,user_agent
  ) values (
    v_auth.project_id,'additional_service',v_auth.id,'additional_service.accepted',
    'Additional service authorization accepted electronically.',
    jsonb_build_object('acceptance_id',v_acceptance_id,'authorized_amount',v_auth.authorized_amount,'document_hash',p_document_hash),
    nullif(p_ip_address,'')::inet,p_user_agent
  );

  return v_auth.project_id;
end;
$$;
