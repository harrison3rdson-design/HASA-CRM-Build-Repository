-- Assign proposal numbers atomically by calendar year.
-- Format: YYYYNNNN. Each year starts at NNNN = 0151.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create table if not exists private.proposal_number_sequences (
  proposal_year integer primary key
    check (proposal_year between 2000 and 9999),
  last_sequence integer not null
    check (last_sequence between 150 and 9999),
  updated_at timestamptz not null default now()
);

alter table private.proposal_number_sequences enable row level security;
revoke all on private.proposal_number_sequences from public, anon, authenticated;

-- Seed each annual counter from existing proposal numbers so enabling the
-- generator can never reuse a number that is already present.
insert into private.proposal_number_sequences (proposal_year, last_sequence)
select
  left(proposal_number, 4)::integer,
  greatest(150, max(right(proposal_number, 4)::integer))
from public.proposals
where proposal_number ~ '^[0-9]{8}$'
  and right(proposal_number, 4)::integer between 151 and 9999
group by left(proposal_number, 4)::integer
on conflict (proposal_year)
do update set
  last_sequence = greatest(
    private.proposal_number_sequences.last_sequence,
    excluded.last_sequence
  ),
  updated_at = now();

create or replace function private.assign_proposal_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer := extract(
    year from timezone('America/New_York', current_timestamp)
  )::integer;
  v_sequence integer;
begin
  -- Keep explicit numbers for imports and historical-data maintenance. The
  -- application omits this column so normal proposal creation is automatic.
  if new.proposal_number is not null and btrim(new.proposal_number) <> '' then
    return new;
  end if;

  insert into private.proposal_number_sequences (
    proposal_year,
    last_sequence,
    updated_at
  )
  values (v_year, 151, now())
  on conflict (proposal_year)
  do update set
    last_sequence = private.proposal_number_sequences.last_sequence + 1,
    updated_at = now()
  returning last_sequence into v_sequence;

  if v_sequence > 9999 then
    raise exception 'Proposal number sequence exhausted for year %.', v_year;
  end if;

  new.proposal_number := format(
    '%s%s',
    v_year,
    lpad(v_sequence::text, 4, '0')
  );

  return new;
end;
$$;

revoke execute on function private.assign_proposal_number()
from public, anon, authenticated;

drop trigger if exists proposals_assign_number on public.proposals;

create trigger proposals_assign_number
before insert on public.proposals
for each row
when (new.proposal_number is null or btrim(new.proposal_number) = '')
execute function private.assign_proposal_number();
