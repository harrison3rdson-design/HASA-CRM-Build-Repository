-- HASA Concepts, LLC
-- Release 1 / Phase 1 Foundation
-- PostgreSQL / Supabase migration
-- Generated 2026-08-30

create extension if not exists pgcrypto;

-- =========================================================
-- Helper functions
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =========================================================
-- Company settings / branding
-- =========================================================

create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null default 'HASA Concepts, LLC',
  display_name text not null default 'HASA Concepts',
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country text default 'United States',
  phone text,
  email text,
  website text,
  tax_id text,
  default_payment_terms text not null default 'NET 15',
  default_currency text not null default 'USD',
  logo_horizontal_path text,
  logo_square_path text,
  primary_color text,
  accent_color text,
  document_footer text,
  proposal_prefix text,
  invoice_prefix text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger company_settings_set_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

insert into public.company_settings (legal_name, display_name)
select 'HASA Concepts, LLC', 'HASA Concepts'
where not exists (select 1 from public.company_settings);

-- =========================================================
-- Application users
-- =========================================================

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  first_name text,
  last_name text,
  email text not null unique,
  mobile_phone text,
  role text not null default 'staff'
    check (role in ('owner_admin','project_manager','staff','accounting','read_only')),
  active boolean not null default true,
  default_bill_rate numeric(12,2),
  internal_cost_rate numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
as $$
  select id
  from public.app_users
  where auth_user_id = auth.uid()
  limit 1;
$$;


-- =========================================================
-- Clients / Contacts
-- =========================================================

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  client_number bigint generated always as identity unique,
  company_name text not null,
  billing_name text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country text,
  phone text,
  email text,
  website text,
  notes text,
  active boolean not null default true,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  first_name text,
  last_name text,
  title text,
  email text,
  mobile_phone text,
  office_phone text,
  is_primary boolean not null default false,
  receives_proposals boolean not null default true,
  receives_invoices boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger contacts_set_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

create unique index if not exists contacts_one_primary_per_client
on public.contacts(client_id)
where is_primary = true;

-- =========================================================
-- Proposal system
-- =========================================================

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_number text not null unique,
  client_id uuid not null references public.clients(id),
  primary_contact_id uuid references public.contacts(id),
  project_name text not null,
  project_location text,
  status text not null default 'draft'
    check (status in (
      'draft','sent','viewed','changes_requested',
      'accepted','declined','expired','superseded'
    )),
  current_revision integer not null default 0,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger proposals_set_updated_at
before update on public.proposals
for each row execute function public.set_updated_at();

create table if not exists public.proposal_revisions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  revision_number integer not null,
  revision_date date not null default current_date,
  professional_fee numeric(12,2) not null default 0,
  estimated_expenses numeric(12,2) not null default 0,
  estimated_total numeric(12,2) generated always as
    (professional_fee + estimated_expenses) stored,
  billing_method text,
  payment_terms text not null default 'NET 15',
  validity_days integer not null default 15,
  internal_notes text,
  locked boolean not null default false,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  unique(proposal_id, revision_number)
);

create table if not exists public.proposal_sections (
  id uuid primary key default gen_random_uuid(),
  proposal_revision_id uuid not null references public.proposal_revisions(id) on delete cascade,
  section_type text not null
    check (section_type in (
      'objective','consultant_responsibility','client_responsibility',
      'deliverable','exclusion','schedule','term','custom'
    )),
  heading text,
  content text not null,
  sort_order integer not null default 0
);

create table if not exists public.proposal_fee_items (
  id uuid primary key default gen_random_uuid(),
  proposal_revision_id uuid not null references public.proposal_revisions(id) on delete cascade,
  description text not null,
  billing_type text not null
    check (billing_type in ('fixed','hourly','not_to_exceed','unit','allowance','optional')),
  quantity numeric(12,3) not null default 1,
  rate numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  sort_order integer not null default 0
);

create table if not exists public.proposal_expense_estimates (
  id uuid primary key default gen_random_uuid(),
  proposal_revision_id uuid not null references public.proposal_revisions(id) on delete cascade,
  category text not null,
  description text,
  estimated_quantity numeric(12,3),
  unit text,
  estimated_rate numeric(12,2),
  estimated_amount numeric(12,2) not null default 0,
  billing_rule text not null default 'actual'
    check (billing_rule in (
      'actual','actual_plus_markup','fixed_rate','per_diem',
      'mileage','allowance','included','not_billable'
    )),
  markup_percent numeric(6,3) not null default 0,
  requires_receipt boolean not null default true,
  sort_order integer not null default 0
);

-- =========================================================
-- Secure proposal delivery / acceptance
-- =========================================================

create table if not exists public.proposal_share_links (
  id uuid primary key default gen_random_uuid(),
  proposal_revision_id uuid not null references public.proposal_revisions(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.proposal_acceptances (
  id uuid primary key default gen_random_uuid(),
  proposal_revision_id uuid not null unique references public.proposal_revisions(id),
  signer_name text not null,
  signer_title text,
  signer_email text,
  signer_mobile text,
  acceptance_statement text not null,
  signature_type text not null default 'typed'
    check (signature_type in ('typed','drawn','none')),
  signature_storage_path text,
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  document_hash text,
  executed_pdf_path text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Projects / project phases
-- =========================================================

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  project_number text not null unique,
  client_id uuid not null references public.clients(id),
  primary_contact_id uuid references public.contacts(id),
  source_proposal_id uuid references public.proposals(id),
  source_revision_id uuid references public.proposal_revisions(id),
  project_name text not null,
  project_location text,
  status text not null default 'pending'
    check (status in ('pending','active','on_hold','complete','closed','cancelled')),
  original_contract_amount numeric(12,2) not null default 0,
  additional_services_amount numeric(12,2) not null default 0,
  authorized_fee numeric(12,2) generated always as
    (original_contract_amount + additional_services_amount) stored,
  start_date date,
  target_completion_date date,
  completion_date date,
  percent_complete numeric(5,2) not null default 0
    check (percent_complete >= 0 and percent_complete <= 100),
  project_manager_id uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create table if not exists public.project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase_name text not null,
  description text,
  authorized_fee numeric(12,2),
  estimated_hours numeric(10,2),
  percent_complete numeric(5,2) not null default 0
    check (percent_complete >= 0 and percent_complete <= 100),
  status text not null default 'pending'
    check (status in ('pending','active','complete','on_hold')),
  sort_order integer not null default 0
);

-- =========================================================
-- Documents / audit trail
-- =========================================================

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  project_id uuid references public.projects(id),
  document_type text not null,
  document_subtype text,
  title text not null,
  storage_path text not null,
  original_filename text,
  mime_type text,
  file_size bigint,
  related_record_type text,
  related_record_id uuid,
  document_date date,
  locked boolean not null default false,
  uploaded_by uuid references public.app_users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id),
  client_id uuid references public.clients(id),
  project_id uuid references public.projects(id),
  record_type text not null,
  record_id uuid,
  event_type text not null,
  event_description text,
  previous_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Immutability safeguards
-- =========================================================

create or replace function public.prevent_locked_revision_changes()
returns trigger
language plpgsql
as $$
begin
  if old.locked = true then
    raise exception 'Accepted/locked proposal revisions cannot be modified or deleted.';
  end if;
  return new;
end;
$$;

drop trigger if exists proposal_revision_no_update_when_locked on public.proposal_revisions;
create trigger proposal_revision_no_update_when_locked
before update on public.proposal_revisions
for each row execute function public.prevent_locked_revision_changes();

create or replace function public.prevent_locked_revision_delete()
returns trigger
language plpgsql
as $$
begin
  if old.locked = true then
    raise exception 'Accepted/locked proposal revisions cannot be deleted.';
  end if;
  return old;
end;
$$;

drop trigger if exists proposal_revision_no_delete_when_locked on public.proposal_revisions;
create trigger proposal_revision_no_delete_when_locked
before delete on public.proposal_revisions
for each row execute function public.prevent_locked_revision_delete();

-- =========================================================
-- Proposal acceptance transaction
-- =========================================================

create or replace function public.accept_proposal_revision(
  p_revision_id uuid,
  p_signer_name text,
  p_signer_title text default null,
  p_signer_email text default null,
  p_signer_mobile text default null,
  p_acceptance_statement text default 'Accepted',
  p_signature_type text default 'typed',
  p_ip_address inet default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision public.proposal_revisions%rowtype;
  v_proposal public.proposals%rowtype;
  v_project_id uuid;
begin
  select * into v_revision
  from public.proposal_revisions
  where id = p_revision_id
  for update;

  if not found then
    raise exception 'Proposal revision not found.';
  end if;

  if v_revision.locked then
    raise exception 'Proposal revision is already locked.';
  end if;

  select * into v_proposal
  from public.proposals
  where id = v_revision.proposal_id
  for update;

  if v_proposal.status in ('accepted','declined','expired','superseded') then
    raise exception 'Proposal is no longer eligible for acceptance.';
  end if;

  insert into public.proposal_acceptances (
    proposal_revision_id,
    signer_name,
    signer_title,
    signer_email,
    signer_mobile,
    acceptance_statement,
    signature_type,
    ip_address,
    user_agent
  ) values (
    p_revision_id,
    p_signer_name,
    p_signer_title,
    p_signer_email,
    p_signer_mobile,
    p_acceptance_statement,
    p_signature_type,
    p_ip_address,
    p_user_agent
  );

  update public.proposal_revisions
  set locked = true
  where id = p_revision_id;

  update public.proposals
  set status = 'accepted',
      current_revision = v_revision.revision_number
  where id = v_proposal.id;

  insert into public.projects (
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

  insert into public.activity_log (
    client_id,
    project_id,
    record_type,
    record_id,
    event_type,
    event_description,
    new_values
  ) values (
    v_proposal.client_id,
    v_project_id,
    'proposal',
    v_proposal.id,
    'proposal.accepted',
    'Proposal accepted and project created automatically.',
    jsonb_build_object(
      'proposal_number', v_proposal.proposal_number,
      'revision_number', v_revision.revision_number,
      'professional_fee', v_revision.professional_fee
    )
  );

  return v_project_id;
end;
$$;

-- =========================================================
-- Row Level Security
-- =========================================================

alter table public.company_settings enable row level security;
alter table public.app_users enable row level security;
alter table public.clients enable row level security;
alter table public.contacts enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_revisions enable row level security;
alter table public.proposal_sections enable row level security;
alter table public.proposal_fee_items enable row level security;
alter table public.proposal_expense_estimates enable row level security;
alter table public.proposal_share_links enable row level security;
alter table public.proposal_acceptances enable row level security;
alter table public.projects enable row level security;
alter table public.project_phases enable row level security;
alter table public.documents enable row level security;
alter table public.activity_log enable row level security;

-- Release 1 Phase 1 assumes authenticated internal users can read core records.
-- More granular role/project assignment policies are added in Phase 2.

create policy "authenticated read company settings"
on public.company_settings for select
to authenticated
using (true);

create policy "authenticated read users"
on public.app_users for select
to authenticated
using (true);

create policy "authenticated read clients"
on public.clients for select
to authenticated
using (true);

create policy "authenticated insert clients"
on public.clients for insert
to authenticated
with check (true);

create policy "authenticated update clients"
on public.clients for update
to authenticated
using (true)
with check (true);

create policy "authenticated read contacts"
on public.contacts for select
to authenticated
using (true);

create policy "authenticated write contacts"
on public.contacts for all
to authenticated
using (true)
with check (true);

create policy "authenticated read proposals"
on public.proposals for select
to authenticated
using (true);

create policy "authenticated write proposals"
on public.proposals for all
to authenticated
using (true)
with check (true);

create policy "authenticated read proposal revisions"
on public.proposal_revisions for select
to authenticated
using (true);

create policy "authenticated write proposal revisions"
on public.proposal_revisions for all
to authenticated
using (true)
with check (true);

create policy "authenticated proposal section access"
on public.proposal_sections for all
to authenticated
using (true)
with check (true);

create policy "authenticated proposal fee access"
on public.proposal_fee_items for all
to authenticated
using (true)
with check (true);

create policy "authenticated proposal expense access"
on public.proposal_expense_estimates for all
to authenticated
using (true)
with check (true);

create policy "authenticated project access"
on public.projects for all
to authenticated
using (true)
with check (true);

create policy "authenticated project phase access"
on public.project_phases for all
to authenticated
using (true)
with check (true);

create policy "authenticated document access"
on public.documents for all
to authenticated
using (true)
with check (true);

create policy "authenticated activity read"
on public.activity_log for select
to authenticated
using (true);

-- Intentionally no anonymous table policies.
-- Public proposal viewing/acceptance should occur through security-definer
-- server functions / API routes that validate hashed share tokens.
