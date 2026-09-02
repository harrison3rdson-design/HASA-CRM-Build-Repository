alter table public.time_entries
  add column if not exists source_fee_item_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'time_entries_source_fee_item_fk'
      and conrelid = 'public.time_entries'::regclass
  ) then
    alter table public.time_entries
      add constraint time_entries_source_fee_item_fk
      foreign key (source_fee_item_id)
      references public.proposal_fee_items(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists time_entries_source_fee_item_idx
  on public.time_entries(source_fee_item_id);

create index if not exists expenses_source_estimate_idx
  on public.expenses(source_estimate_id);

create or replace function public.round_time_entry_hours_up()
returns trigger
language plpgsql
as $$
begin
  new.hours := ceil(new.hours * 2) / 2;
  return new;
end;
$$;

drop trigger if exists time_entries_round_hours_up on public.time_entries;
create trigger time_entries_round_hours_up
before insert or update of hours on public.time_entries
for each row execute function public.round_time_entry_hours_up();

create or replace function public.round_proposal_labor_hours_up()
returns trigger
language plpgsql
as $$
begin
  if new.billing_type = 'hourly' then
    new.quantity := ceil(new.quantity * 2) / 2;
    new.amount := round(new.quantity * new.rate, 2);
  end if;
  return new;
end;
$$;

drop trigger if exists proposal_fee_items_round_hours_up on public.proposal_fee_items;
create trigger proposal_fee_items_round_hours_up
before insert or update of quantity, rate, billing_type on public.proposal_fee_items
for each row execute function public.round_proposal_labor_hours_up();

create or replace function public.round_invoice_time_hours_up()
returns trigger
language plpgsql
as $$
begin
  if new.item_type in ('hourly', 'travel_time') then
    new.quantity := ceil(new.quantity * 2) / 2;
    new.amount := round(new.quantity * new.rate, 2);
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_items_round_time_hours_up on public.invoice_items;
create trigger invoice_items_round_time_hours_up
before insert or update of quantity, rate, item_type on public.invoice_items
for each row execute function public.round_invoice_time_hours_up();

alter table public.time_entries
  add constraint time_entries_half_hour_increment
  check (mod(hours, 0.5) = 0);

alter table public.proposal_fee_items
  add constraint proposal_fee_items_half_hour_increment
  check (billing_type <> 'hourly' or mod(quantity, 0.5) = 0);

alter table public.invoice_items
  add constraint invoice_items_half_hour_increment
  check (item_type not in ('hourly', 'travel_time') or mod(quantity, 0.5) = 0);
