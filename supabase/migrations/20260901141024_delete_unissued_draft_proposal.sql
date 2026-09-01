create or replace function public.delete_unissued_draft_proposal(p_proposal_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_proposal public.proposals%rowtype;
  v_proposal_year integer;
  v_proposal_sequence integer;
  v_current_year integer := extract(
    year from timezone('America/New_York', current_timestamp)
  )::integer;
begin
  select * into v_proposal
  from public.proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposal not found.';
  end if;

  if v_proposal.status <> 'draft' then
    raise exception 'Only a draft proposal can be deleted.';
  end if;

  if v_proposal.proposal_number !~ '^[0-9]{8}$' then
    raise exception 'This proposal number cannot be released automatically.';
  end if;

  v_proposal_year := left(v_proposal.proposal_number, 4)::integer;
  v_proposal_sequence := right(v_proposal.proposal_number, 4)::integer;

  if v_proposal_year <> v_current_year then
    raise exception 'Only the current calendar year''s latest draft proposal can be deleted and released.';
  end if;

  perform 1
  from private.proposal_number_sequences
  where proposal_year = v_proposal_year
    and last_sequence = v_proposal_sequence
  for update;

  if not found then
    raise exception 'Delete newer draft proposals first. Only the latest proposal number can be released.';
  end if;

  if exists (
    select 1
    from public.proposal_revisions
    where proposal_id = p_proposal_id
      and locked
  ) then
    raise exception 'A proposal with a sent or locked version cannot be deleted.';
  end if;

  if exists (
    select 1
    from public.proposal_acceptances a
    join public.proposal_revisions r on r.id = a.proposal_revision_id
    where r.proposal_id = p_proposal_id
  ) then
    raise exception 'An accepted proposal cannot be deleted.';
  end if;

  if exists (
    select 1
    from public.projects p
    where p.source_proposal_id = p_proposal_id
       or p.source_revision_id in (
         select id
         from public.proposal_revisions
         where proposal_id = p_proposal_id
       )
  ) then
    raise exception 'A proposal connected to a project or invoice cannot be deleted.';
  end if;

  if exists (
    select 1
    from public.proposal_share_links l
    join public.proposal_revisions r on r.id = l.proposal_revision_id
    where r.proposal_id = p_proposal_id
      and (
        l.first_viewed_at is not null
        or l.last_viewed_at is not null
        or l.view_count > 0
        or l.accepted_at is not null
        or l.last_delivery_at is not null
      )
  ) then
    raise exception 'A proposal that was viewed or issued to a customer cannot be deleted.';
  end if;

  if exists (
    select 1
    from public.document_deliveries
    where document_type = 'proposal'
      and related_record_id = p_proposal_id
      and (
        sent_at is not null
        or status in ('queued', 'sent', 'delivered')
      )
  ) then
    raise exception 'A proposal that was issued to a customer cannot be deleted.';
  end if;

  if exists (
    select 1
    from public.generated_documents
    where document_type in ('proposal', 'executed_proposal')
      and related_record_id = p_proposal_id
      and locked
  ) then
    raise exception 'A proposal with a locked generated document cannot be deleted.';
  end if;

  insert into public.activity_log (
    client_id,
    record_type,
    record_id,
    event_type,
    event_description,
    new_values
  ) values (
    v_proposal.client_id,
    'proposal',
    v_proposal.id,
    'proposal.deleted',
    'Unissued draft proposal deleted and its number released.',
    jsonb_build_object(
      'proposal_number', v_proposal.proposal_number,
      'number_released', true
    )
  );

  delete from public.document_deliveries
  where document_type = 'proposal'
    and related_record_id = p_proposal_id;

  delete from public.generated_documents
  where document_type = 'proposal'
    and related_record_id = p_proposal_id
    and not locked;

  delete from public.proposals
  where id = p_proposal_id;

  update private.proposal_number_sequences
  set last_sequence = greatest(150, v_proposal_sequence - 1),
      updated_at = now()
  where proposal_year = v_proposal_year
    and last_sequence = v_proposal_sequence;

  if not found then
    raise exception 'The proposal number changed before it could be released.';
  end if;

  return v_proposal.proposal_number;
end;
$$;

revoke execute on function public.delete_unissued_draft_proposal(uuid)
from public, anon, authenticated;

grant execute on function public.delete_unissued_draft_proposal(uuid)
to service_role;
