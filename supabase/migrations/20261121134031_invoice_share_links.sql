-- Stable, revocable customer links for private invoice PDFs.
-- Raw tokens are delivered to customers; only their SHA-256 hashes are stored.

create table public.invoice_share_links (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  document_id uuid not null references public.generated_documents(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invoice_share_links_token_hash_format
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint invoice_share_links_expiry_after_creation
    check (expires_at > created_at)
);

create index invoice_share_links_invoice_created_idx
on public.invoice_share_links(invoice_id, created_at desc);

create index invoice_share_links_document_idx
on public.invoice_share_links(document_id);

alter table public.invoice_share_links enable row level security;

-- Invoice links are resolved only by trusted server routes using service_role.
revoke all privileges on table public.invoice_share_links
from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.invoice_share_links
to service_role;
