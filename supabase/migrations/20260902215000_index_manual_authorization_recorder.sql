create index if not exists proposal_acceptances_recorded_by_idx
on public.proposal_acceptances(recorded_by)
where recorded_by is not null;
