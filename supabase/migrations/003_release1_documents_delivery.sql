-- HASA Concepts, LLC
-- Release 1 / Phase 3 Customer Documents + Delivery
-- Assumes Phase 1 and Phase 2 migrations are already applied.
-- Generated 2026-08-30

-- =========================================================
-- Branding additions
-- =========================================================

alter table public.company_settings
  add column if not exists document_header_style text not null default 'horizontal_logo',
  add column if not exists invoice_footer text,
  add column if not exists proposal_footer text;

-- =========================================================
-- Document delivery history
-- =========================================================

create table if not exists public.document_deliveries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  project_id uuid references public.projects(id),
  document_type text not null
    check (document_type in ('proposal','additional_service','invoice')),
  related_record_id uuid not null,
  delivery_method text not null
    check (delivery_method in ('sms','email')),
  recipient_name text,
  recipient_address text not null,
  provider text,
  provider_message_id text,
  status text not null default 'queued'
    check (status in ('queued','sent','delivered','failed','bounced')),
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  project_id uuid references public.projects(id),
  document_type text not null
    check (document_type in (
      'proposal','executed_proposal','additional_service',
      'executed_authorization','invoice','receipt_appendix'
    )),
  related_record_id uuid not null,
  revision_number integer,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null default 'application/pdf',
  file_size bigint,
  sha256_hash text not null,
  locked boolean not null default false,
  generated_by uuid references public.app_users(id),
  generated_at timestamptz not null default now()
);

create index if not exists generated_documents_related_idx
on public.generated_documents(document_type, related_record_id);

create index if not exists document_deliveries_related_idx
on public.document_deliveries(document_type, related_record_id);

-- =========================================================
-- Receipt appendix configuration
-- =========================================================

alter table public.invoices
  add column if not exists include_expense_detail boolean not null default false,
  add column if not exists include_receipt_appendix boolean not null default false;

-- =========================================================
-- Public-link protections
-- =========================================================

create or replace function public.register_proposal_view(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.proposal_share_links%rowtype;
begin
  select * into v_link
  from public.proposal_share_links
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'Invalid proposal link.';
  end if;

  if v_link.revoked_at is not null then
    raise exception 'Proposal link has been revoked.';
  end if;

  if v_link.expires_at is not null and v_link.expires_at < now() then
    raise exception 'Proposal link has expired.';
  end if;

  update public.proposal_share_links
  set first_viewed_at = coalesce(first_viewed_at, now()),
      last_viewed_at = now(),
      view_count = view_count + 1
  where id = v_link.id;

  update public.proposals p
  set status = case when p.status = 'sent' then 'viewed' else p.status end
  from public.proposal_revisions r
  where r.id = v_link.proposal_revision_id
    and p.id = r.proposal_id;

  return v_link.proposal_revision_id;
end;
$$;

create or replace function public.register_additional_service_view(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.additional_service_share_links%rowtype;
begin
  select * into v_link
  from public.additional_service_share_links
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'Invalid authorization link.';
  end if;

  if v_link.revoked_at is not null then
    raise exception 'Authorization link has been revoked.';
  end if;

  if v_link.expires_at is not null and v_link.expires_at < now() then
    raise exception 'Authorization link has expired.';
  end if;

  update public.additional_service_share_links
  set first_viewed_at = coalesce(first_viewed_at, now()),
      last_viewed_at = now(),
      view_count = view_count + 1
  where id = v_link.id;

  update public.additional_services
  set status = case when status = 'sent' then 'viewed' else status end
  where id = v_link.additional_service_id;

  return v_link.additional_service_id;
end;
$$;

-- =========================================================
-- Executed-document hash update helpers
-- =========================================================

create or replace function public.attach_executed_proposal_document(
  p_revision_id uuid,
  p_storage_path text,
  p_sha256_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.proposal_acceptances
  set executed_pdf_path = p_storage_path,
      document_hash = p_sha256_hash
  where proposal_revision_id = p_revision_id;

  if not found then
    raise exception 'Proposal acceptance record not found.';
  end if;
end;
$$;

create or replace function public.attach_executed_authorization_document(
  p_additional_service_id uuid,
  p_storage_path text,
  p_sha256_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.additional_service_acceptances
  set executed_pdf_path = p_storage_path,
      document_hash = p_sha256_hash
  where additional_service_id = p_additional_service_id;

  update public.additional_services
  set executed_pdf_path = p_storage_path,
      document_hash = p_sha256_hash
  where id = p_additional_service_id;
end;
$$;

create or replace function public.attach_invoice_document(
  p_invoice_id uuid,
  p_storage_path text,
  p_sha256_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invoices
  set pdf_storage_path = p_storage_path,
      document_hash = p_sha256_hash
  where id = p_invoice_id;

  if not found then
    raise exception 'Invoice not found.';
  end if;
end;
$$;

-- =========================================================
-- RLS
-- =========================================================

alter table public.document_deliveries enable row level security;
alter table public.generated_documents enable row level security;

create policy "authenticated delivery access"
on public.document_deliveries for all
to authenticated
using (true)
with check (true);

create policy "authenticated generated document access"
on public.generated_documents for all
to authenticated
using (true)
with check (true);

-- Do not expose these tables directly to anonymous clients.
-- Public routes should validate a raw token server-side, hash it, then
-- call security-definer functions or server queries using controlled access.
