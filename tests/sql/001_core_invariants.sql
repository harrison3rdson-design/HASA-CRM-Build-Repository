-- Run against disposable staging database after migrations.

begin;

-- Original contract and additional services must be independent.
do $$
declare v numeric;
begin
  select count(*) into v
  from information_schema.columns
  where table_schema='public' and table_name='projects'
    and column_name in ('original_contract_amount','additional_services_amount','authorized_fee');
  if v <> 3 then raise exception 'Project financial columns missing.'; end if;
end $$;

-- Required public-link protections.
do $$
declare v numeric;
begin
  select count(*) into v
  from information_schema.columns
  where table_schema='public' and table_name='proposal_share_links'
    and column_name in ('token_hash','expires_at','revoked_at');
  if v <> 3 then raise exception 'Proposal link security columns missing.'; end if;
end $$;

-- One-active-timer partial index should exist.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='time_entries_one_active_timer_per_user'
  ) then raise exception 'Active timer uniqueness index missing.'; end if;
end $$;

rollback;
