-- Additive digital-twin records. Existing capture/project budgets are unchanged.
alter table public.proposal_revisions add column service_terms jsonb;
create function public.valid_service_terms(t jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
  if t is null then return true; end if;
  return jsonb_typeof(t)='object'
    and jsonb_typeof(t->'name')='string' and length(trim(t->>'name')) between 1 and 150
    and jsonb_typeof(t->'scope')='string' and length(trim(t->>'scope')) between 1 and 10000
    and jsonb_typeof(t->'refreshScope')='string' and length(t->>'refreshScope')<=5000
    and jsonb_typeof(t->'monthlyFee')='number' and (t->>'monthlyFee')::numeric between 0.01 and 1000000
    and jsonb_typeof(t->'refreshMonthlyFee')='number' and (t->>'refreshMonthlyFee')::numeric between 0 and 1000000
    and jsonb_typeof(t->'termMonths')='number' and (t->>'termMonths')::numeric between 1 and 60 and mod((t->>'termMonths')::numeric,1)=0
    and jsonb_typeof(t->'modelAllowance')='number' and (t->>'modelAllowance')::numeric between 1 and 10000 and mod((t->>'modelAllowance')::numeric,1)=0
    and jsonb_typeof(t->'maintenanceMinutes')='number' and (t->>'maintenanceMinutes')::numeric between 0 and 100000 and mod((t->>'maintenanceMinutes')::numeric,1)=0
    and ((t->>'refreshMonthlyFee')::numeric=0 or length(trim(t->>'refreshScope'))>0);
exception when others then return false;
end; $$;
alter table public.proposal_revisions add constraint valid_recurring_terms check (public.valid_service_terms(service_terms) is true);

create sequence public.service_agreement_number_seq;
create sequence public.service_invoice_number_seq;
create table public.properties (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id),
  name text not null check(length(trim(name)) between 1 and 200),
  property_type text not null check(property_type in ('vacation_rental','commercial','resort','other')),
  address text not null, square_feet numeric(12,2) check(square_feet>=0),
  access_notes text, active boolean not null default true, created_at timestamptz not null default now(),
  unique(id,client_id)
);
create index properties_client_idx on public.properties(client_id);
create table public.digital_twin_models (
  id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id),
  name text not null, model_url text not null check(model_url ~ '^https://[^[:space:]]+$'),
  captured_on date not null, visibility text not null check(visibility in ('guest_facing','internal')),
  capacity_units integer not null default 1 check(capacity_units between 1 and 10000),
  hosted boolean not null default true, notes text, created_at timestamptz not null default now()
);
create index digital_twin_models_property_idx on public.digital_twin_models(property_id);
create table public.service_agreements (
  id uuid primary key default gen_random_uuid(),
  agreement_number text not null unique default ('SA-'||lpad(nextval('public.service_agreement_number_seq')::text,6,'0')),
  client_id uuid not null references public.clients(id),
  source_revision_id uuid not null unique references public.proposal_revisions(id),
  billing_project_id uuid unique references public.projects(id),
  terms jsonb not null check(public.valid_service_terms(terms) is true),
  status text not null default 'draft' check(status in ('draft','active','cancelled','completed')),
  starts_on date, ends_on date, cancelled_on date, activated_at timestamptz,
  created_at timestamptz not null default now(),
  unique(id,client_id),
  check(status='draft' or (starts_on is not null and ends_on>starts_on and billing_project_id is not null))
);
create index service_agreements_client_idx on public.service_agreements(client_id);
create table public.service_agreement_properties (
  agreement_id uuid not null, property_id uuid not null, client_id uuid not null,
  primary key(agreement_id,property_id),
  foreign key(agreement_id,client_id) references public.service_agreements(id,client_id),
  foreign key(property_id,client_id) references public.properties(id,client_id)
);
create index service_agreement_properties_property_idx on public.service_agreement_properties(property_id,client_id);
create table public.service_work_entries (
  id uuid primary key default gen_random_uuid(), agreement_id uuid not null references public.service_agreements(id),
  work_date date not null, minutes integer not null check(minutes between 1 and 1440),
  description text not null, created_by uuid not null references public.app_users(id), created_at timestamptz not null default now()
);
create index service_work_agreement_idx on public.service_work_entries(agreement_id,work_date);
create table public.service_refresh_tasks (
  id uuid primary key default gen_random_uuid(), agreement_id uuid not null references public.service_agreements(id),
  due_on date not null, scope text not null, status text not null default 'planned' check(status in ('planned','complete','cancelled')),
  completed_on date, created_at timestamptz not null default now()
);
create index service_refresh_agreement_idx on public.service_refresh_tasks(agreement_id);
alter table public.invoices add column service_agreement_id uuid references public.service_agreements(id), add column service_period integer;
alter table public.invoices add constraint service_period_pair check ((service_agreement_id is null and service_period is null) or (service_agreement_id is not null and service_period>=0));
create unique index invoices_service_period_unique on public.invoices(service_agreement_id,service_period) where service_agreement_id is not null;
alter table public.invoices drop constraint invoices_invoice_type_check;
alter table public.invoices add constraint invoices_invoice_type_check check(invoice_type in ('advance','progress','milestone','hourly','expense','final','credit','recurring'));

-- Match the existing single-company role model, including its AAL2 MFA check.
alter table public.properties enable row level security;
revoke all on public.properties from anon, authenticated;
grant select on public.properties to authenticated;
grant all on public.properties to service_role;
create policy internal_read on public.properties for select to authenticated using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
alter table public.digital_twin_models enable row level security;
revoke all on public.digital_twin_models from anon, authenticated;
grant select on public.digital_twin_models to authenticated;
grant all on public.digital_twin_models to service_role;
create policy internal_read on public.digital_twin_models for select to authenticated using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
alter table public.service_agreements enable row level security;
revoke all on public.service_agreements from anon, authenticated;
grant select on public.service_agreements to authenticated;
grant all on public.service_agreements to service_role;
create policy internal_read on public.service_agreements for select to authenticated using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
alter table public.service_agreement_properties enable row level security;
revoke all on public.service_agreement_properties from anon, authenticated;
grant select on public.service_agreement_properties to authenticated;
grant all on public.service_agreement_properties to service_role;
create policy internal_read on public.service_agreement_properties for select to authenticated using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
alter table public.service_work_entries enable row level security;
revoke all on public.service_work_entries from anon, authenticated;
grant select on public.service_work_entries to authenticated;
grant all on public.service_work_entries to service_role;
create policy internal_read on public.service_work_entries for select to authenticated using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
alter table public.service_refresh_tasks enable row level security;
revoke all on public.service_refresh_tasks from anon, authenticated;
grant select on public.service_refresh_tasks to authenticated;
grant all on public.service_refresh_tasks to service_role;
create policy internal_read on public.service_refresh_tasks for select to authenticated using (private.has_role(array['owner_admin','project_manager','staff','accounting','read_only']));
-- Writes use authenticated server actions with role checks and the service-role client.
-- No browser writes or anonymous access are granted.
grant usage,select on sequence public.service_agreement_number_seq, public.service_invoice_number_seq to service_role;

create function public.update_proposal_revision_draft_v10(
 p_revision_id uuid,p_payment_terms text,p_validity_days integer,p_billing_method text,p_proposal_terms text,
 p_proposal_terms_json jsonb,p_sections jsonb,p_fee_items jsonb,p_expense_items jsonb,p_material_items jsonb,p_alternates jsonb,p_service_terms jsonb
) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid; begin
 result:=public.update_proposal_revision_draft_v9(p_revision_id,p_payment_terms,p_validity_days,p_billing_method,p_proposal_terms,p_proposal_terms_json,p_sections,p_fee_items,p_expense_items,p_material_items,p_alternates);
 update public.proposal_revisions set service_terms=p_service_terms where id=p_revision_id;
 return result;
end; $$;
revoke all on function public.update_proposal_revision_draft_v10(uuid,text,integer,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.update_proposal_revision_draft_v10(uuid,text,integer,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;

-- Preserve recurring terms inside the immutable acceptance snapshot.
create function public.snapshot_recurring_terms() returns trigger language plpgsql security invoker set search_path='' as $$
declare t jsonb; begin
 select service_terms into t from public.proposal_revisions where id=new.proposal_revision_id;
 if t is not null and new.accepted_snapshot is not null then
   new.accepted_snapshot:=jsonb_set(new.accepted_snapshot,'{recurringServices}',t,true);
 end if;
 return new;
end; $$;
create trigger zz_snapshot_recurring_terms before insert on public.proposal_acceptances for each row execute function public.snapshot_recurring_terms();

create function public.create_service_agreement(p_revision_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare r public.proposal_revisions%rowtype; c uuid; result uuid; begin
 select * into strict r from public.proposal_revisions where id=p_revision_id for update;
 select client_id into c from public.proposals where id=r.proposal_id;
 if r.service_terms is null or not exists(select 1 from public.proposal_acceptances where proposal_revision_id=r.id) then raise exception 'An accepted proposal with recurring terms is required.'; end if;
 insert into public.service_agreements(client_id,source_revision_id,terms) values(c,r.id,r.service_terms)
 on conflict(source_revision_id) do update set source_revision_id=excluded.source_revision_id returning id into result;
 return result;
end; $$;

create function public.activate_service_agreement(p_agreement_id uuid,p_starts_on date) returns void language plpgsql security invoker set search_path='' as $$
declare a public.service_agreements%rowtype; project_id uuid; accepted_date date; begin
 select * into strict a from public.service_agreements where id=p_agreement_id for update;
 if a.status<>'draft' then raise exception 'Only draft agreements can be activated.'; end if;
 select min((accepted_at at time zone 'America/New_York')::date) into accepted_date from public.proposal_acceptances where proposal_revision_id=a.source_revision_id;
 if p_starts_on is null or p_starts_on<accepted_date then raise exception 'Service cannot start before acceptance.'; end if;
 if not exists(select 1 from public.service_agreement_properties where agreement_id=a.id) then raise exception 'Add the covered properties before activation.'; end if;
 insert into public.projects(project_number,client_id,project_name,status,original_contract_amount,start_date,primary_contact_id)
 values('SVC-'||substring(a.agreement_number from 4),a.client_id,'Recurring services — '||(a.terms->>'name'),'active',((a.terms->>'monthlyFee')::numeric+(a.terms->>'refreshMonthlyFee')::numeric)*(a.terms->>'termMonths')::integer,p_starts_on,(select primary_contact_id from public.proposals where id=(select proposal_id from public.proposal_revisions where id=a.source_revision_id))) returning id into project_id;
 update public.service_agreements set status='active',starts_on=p_starts_on,ends_on=(p_starts_on+make_interval(months=>(a.terms->>'termMonths')::integer))::date,billing_project_id=project_id,activated_at=now() where id=a.id;
end; $$;

create function public.cancel_service_agreement(p_agreement_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare a public.service_agreements%rowtype; begin
 select * into strict a from public.service_agreements where id=p_agreement_id for update;
 if a.status<>'active' then raise exception 'Only active agreements can be cancelled.'; end if;
 update public.service_agreements set status='cancelled',cancelled_on=(now() at time zone 'America/New_York')::date where id=a.id;
 update public.projects set status='closed' where id=a.billing_project_id;
end; $$;

-- Atomic per agreement. Stable period dates (Jan 31 -> Feb 28 -> Mar 31),
-- row locking + unique period key make cron retries and concurrent runs safe.
create function public.generate_service_invoices(p_agreement_id uuid default null) returns integer language plpgsql security invoker set search_path='' as $$
declare a public.service_agreements%rowtype; n integer; d date; period_end date; inv uuid; count_created integer:=0;
 today date:=(now() at time zone 'America/New_York')::date; begin
 for a in select * from public.service_agreements where status='active' and (p_agreement_id is null or id=p_agreement_id) order by id for update loop
   for n in 0..((a.terms->>'termMonths')::integer-1) loop
     d:=(a.starts_on+make_interval(months=>n))::date;
     period_end:=(a.starts_on+make_interval(months=>n+1))::date;
     if d>today then exit; end if;
     if exists(select 1 from public.invoices where service_agreement_id=a.id and service_period=n) then continue; end if;
     insert into public.invoices(invoice_number,client_id,project_id,invoice_type,invoice_date,payment_terms,status,service_agreement_id,service_period,customer_notes)
     values('SVC-'||extract(year from d)::text||'-'||lpad(nextval('public.service_invoice_number_seq')::text,6,'0'),a.client_id,a.billing_project_id,'recurring',d,'Due on Receipt','draft',a.id,n,
       a.agreement_number||' · Service period '||d::text||' through '||(period_end-1)::text||'. Monthly billing in advance. Initial capture is separate.') returning id into inv;
     insert into public.invoice_items(invoice_id,item_type,description,quantity,rate,amount,sort_order)
     values(inv,'professional_fee',a.terms->>'name',1,(a.terms->>'monthlyFee')::numeric,(a.terms->>'monthlyFee')::numeric,0);
     if (a.terms->>'refreshMonthlyFee')::numeric>0 then
       insert into public.invoice_items(invoice_id,item_type,description,quantity,rate,amount,sort_order)
       values(inv,'professional_fee','Scheduled refresh allowance',1,(a.terms->>'refreshMonthlyFee')::numeric,(a.terms->>'refreshMonthlyFee')::numeric,1);
     end if;
     perform public.recalculate_invoice(inv);
     count_created:=count_created+1;
   end loop;
   if today>=a.ends_on then
     update public.service_agreements set status='completed' where id=a.id;
     update public.projects set status='complete',completion_date=today where id=a.billing_project_id;
   end if;
 end loop;
 return count_created;
end; $$;

-- Only server actions / scheduled maintenance can execute billing mutations.
do $$ declare f text; begin
 foreach f in array array['create_service_agreement(uuid)','activate_service_agreement(uuid,date)','cancel_service_agreement(uuid)','generate_service_invoices(uuid)','snapshot_recurring_terms()'] loop
   execute 'revoke all on function public.'||f||' from public,anon,authenticated';
   execute 'grant execute on function public.'||f||' to service_role';
 end loop;
end $$;

create function public.set_service_coverage(p_agreement_id uuid,p_property_id uuid,p_remove boolean default false) returns void language plpgsql security invoker set search_path='' as $$
declare a public.service_agreements%rowtype; begin
 select * into strict a from public.service_agreements where id=p_agreement_id for update;
 if a.status<>'draft' then raise exception 'Coverage is locked after activation. Use a new accepted agreement for scope changes.'; end if;
 if p_remove then delete from public.service_agreement_properties where agreement_id=a.id and property_id=p_property_id;
 else
  if not exists(select 1 from public.properties where id=p_property_id and client_id=a.client_id and active) then raise exception 'Choose an active property belonging to this client.'; end if;
  insert into public.service_agreement_properties(agreement_id,property_id,client_id) values(a.id,p_property_id,a.client_id) on conflict do nothing;
 end if;
end; $$;
revoke all on function public.set_service_coverage(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_service_coverage(uuid,uuid,boolean) to service_role;

create or replace function public.calculate_invoice_due_date(
  p_sent_at timestamptz,
  p_payment_terms text
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_days integer;
begin
  if p_sent_at is null then
    return null;
  end if;

  v_days := case p_payment_terms
    when 'Due on Receipt' then 0
    when 'NET 15' then 15
    when 'NET 30' then 30
    when 'NET 90' then 90
    else null
  end;

  if v_days is null then
    raise exception 'Payment terms must be Due on Receipt, NET 15, NET 30, or NET 90.';
  end if;

  return timezone('America/New_York', p_sent_at)::date + v_days;
end;
$$;


alter table public.invoices drop constraint if exists invoices_payment_terms_check;
alter table public.invoices add constraint invoices_payment_terms_check check(payment_terms in ('Due on Receipt','NET 15','NET 30','NET 90'));
