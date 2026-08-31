create or replace function public.prevent_locked_revision_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.locked = true and new is distinct from old then
    raise exception 'Sent or accepted proposal revisions cannot be modified.';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_locked_revision_item_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_old_revision_id uuid;
  v_new_revision_id uuid;
begin
  if tg_op <> 'INSERT' then
    v_old_revision_id := old.proposal_revision_id;
    if exists (
      select 1
      from public.proposal_revisions
      where id = v_old_revision_id and locked = true
    ) then
      raise exception 'Sent or accepted proposal revision items cannot be modified.';
    end if;
  end if;

  if tg_op <> 'DELETE' then
    v_new_revision_id := new.proposal_revision_id;
    if exists (
      select 1
      from public.proposal_revisions
      where id = v_new_revision_id and locked = true
    ) then
      raise exception 'Items cannot be added to a sent or accepted proposal revision.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists proposal_sections_no_changes_when_locked on public.proposal_sections;
create trigger proposal_sections_no_changes_when_locked
before insert or update or delete on public.proposal_sections
for each row execute function public.prevent_locked_revision_item_changes();

drop trigger if exists proposal_fee_items_no_changes_when_locked on public.proposal_fee_items;
create trigger proposal_fee_items_no_changes_when_locked
before insert or update or delete on public.proposal_fee_items
for each row execute function public.prevent_locked_revision_item_changes();

drop trigger if exists proposal_expenses_no_changes_when_locked on public.proposal_expense_estimates;
create trigger proposal_expenses_no_changes_when_locked
before insert or update or delete on public.proposal_expense_estimates
for each row execute function public.prevent_locked_revision_item_changes();

create or replace function public.lock_current_proposal_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'draft' then
    update public.proposal_revisions
    set locked = true
    where proposal_id = new.id
      and revision_number = new.current_revision
      and locked = false;
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_lock_current_revision_after_send on public.proposals;
create trigger proposals_lock_current_revision_after_send
after insert or update on public.proposals
for each row execute function public.lock_current_proposal_revision();

update public.proposal_revisions r
set locked = true
from public.proposals p
where p.id = r.proposal_id
  and p.current_revision = r.revision_number
  and p.status <> 'draft'
  and r.locked = false;

create or replace function public.mark_proposal_revision_sent(p_revision_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_revision public.proposal_revisions%rowtype;
  v_proposal public.proposals%rowtype;
begin
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
    raise exception 'Only the current proposal revision can be sent.';
  end if;

  if v_proposal.status in ('accepted', 'declined', 'expired', 'superseded') then
    raise exception 'This proposal is no longer eligible to be sent.';
  end if;

  if not v_revision.locked then
    update public.proposal_revisions
    set locked = true
    where id = v_revision.id;
  end if;

  update public.proposals
  set status = 'sent', sent_at = coalesce(sent_at, now())
  where id = v_proposal.id;

  return v_proposal.id;
end;
$$;

revoke execute on function public.mark_proposal_revision_sent(uuid) from public, anon, authenticated;
grant execute on function public.mark_proposal_revision_sent(uuid) to service_role;

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

  if v_proposal.status not in ('sent','viewed','changes_requested') then
    raise exception 'Proposal is not eligible for acceptance.';
  end if;

  insert into public.proposal_acceptances(
    proposal_revision_id,signer_name,signer_title,signer_email,signer_mobile,
    acceptance_statement,signature_type,accepted_at,ip_address,user_agent,executed_pdf_path,document_hash
  ) values (
    v_revision.id,p_signer_name,p_signer_title,p_signer_email,p_signer_mobile,
    p_acceptance_statement,p_signature_type,now(),nullif(p_ip_address,'')::inet,p_user_agent,p_executed_pdf_path,p_document_hash
  ) returning id into v_acceptance_id;

  if not v_revision.locked then
    update public.proposal_revisions set locked=true where id=v_revision.id;
  end if;
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
