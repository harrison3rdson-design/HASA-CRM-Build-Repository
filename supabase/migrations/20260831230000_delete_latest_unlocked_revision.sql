create or replace function public.delete_latest_unlocked_proposal_revision(p_proposal_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_proposal public.proposals%rowtype;
  v_latest public.proposal_revisions%rowtype;
  v_previous public.proposal_revisions%rowtype;
  v_previous_status text;
begin
  select * into v_proposal
  from public.proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposal not found.';
  end if;

  select * into v_latest
  from public.proposal_revisions
  where proposal_id = p_proposal_id
  order by revision_number desc
  limit 1
  for update;

  if not found then
    raise exception 'Proposal has no revisions.';
  end if;

  if v_latest.revision_number <> v_proposal.current_revision then
    raise exception 'The proposal current revision is inconsistent.';
  end if;

  if v_latest.locked then
    raise exception 'The latest proposal revision is locked and cannot be deleted.';
  end if;

  if v_latest.revision_number <= 1 then
    raise exception 'Revision 1 cannot be deleted. Delete the proposal instead.';
  end if;

  if exists (
    select 1 from public.proposal_acceptances
    where proposal_revision_id = v_latest.id
  ) or exists (
    select 1 from public.projects
    where source_revision_id = v_latest.id
  ) then
    raise exception 'An accepted or project-linked revision cannot be deleted.';
  end if;

  delete from public.proposal_revisions
  where id = v_latest.id;

  select * into v_previous
  from public.proposal_revisions
  where proposal_id = p_proposal_id
  order by revision_number desc
  limit 1
  for update;

  if not found then
    raise exception 'A proposal must retain at least one revision.';
  end if;

  if v_previous.locked then
    if exists (
      select 1 from public.proposal_acceptances
      where proposal_revision_id = v_previous.id
    ) then
      v_previous_status := 'accepted';
    else
      v_previous_status := 'sent';
    end if;
  else
    v_previous_status := 'draft';
  end if;

  update public.proposals
  set current_revision = v_previous.revision_number,
      status = v_previous_status,
      accepted_at = case when v_previous_status = 'accepted' then accepted_at else null end
  where id = p_proposal_id;

  return v_previous.revision_number;
end;
$$;

revoke execute on function public.delete_latest_unlocked_proposal_revision(uuid)
from public, anon, authenticated;

grant execute on function public.delete_latest_unlocked_proposal_revision(uuid)
to service_role;
