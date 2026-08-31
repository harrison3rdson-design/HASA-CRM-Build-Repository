-- HASA Concepts, LLC
-- Release 1 / Phase 4 Production Hardening
-- Assumes Phases 1-3 already applied.
-- Generated 2026-08-30

-- =========================================================
-- Role helpers
-- =========================================================

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.app_users
  where auth_user_id = auth.uid()
    and active = true
  limit 1;
$$;

create or replace function public.has_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = any(p_roles), false);
$$;

-- =========================================================
-- Invoice numbering
-- Format: YYYY-PPPP-NN where PPPP derives from project number
-- Example project 20260152 -> invoice 2026-0152-01
-- =========================================================

create table if not exists public.invoice_number_sequences (
  project_id uuid primary key references public.projects(id) on delete cascade,
  last_sequence integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.next_invoice_number(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_number text;
  v_year text;
  v_project_suffix text;
  v_seq integer;
begin
  select project_number into v_project_number
  from public.projects
  where id = p_project_id;

  if not found then
    raise exception 'Project not found.';
  end if;

  v_year := left(v_project_number, 4);
  v_project_suffix := right(v_project_number, 4);

  insert into public.invoice_number_sequences(project_id, last_sequence)
  values (p_project_id, 1)
  on conflict (project_id)
  do update set
    last_sequence = public.invoice_number_sequences.last_sequence + 1,
    updated_at = now()
  returning last_sequence into v_seq;

  return format('%s-%s-%s', v_year, v_project_suffix, lpad(v_seq::text, 2, '0'));
end;
$$;

-- =========================================================
-- Additional-service numbering
-- =========================================================

create table if not exists public.additional_service_sequences (
  project_id uuid primary key references public.projects(id) on delete cascade,
  last_sequence integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.next_additional_service_number(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_number text;
  v_seq integer;
begin
  select project_number into v_project_number
  from public.projects
  where id = p_project_id;

  if not found then
    raise exception 'Project not found.';
  end if;

  insert into public.additional_service_sequences(project_id, last_sequence)
  values (p_project_id, 1)
  on conflict (project_id)
  do update set
    last_sequence = public.additional_service_sequences.last_sequence + 1,
    updated_at = now()
  returning last_sequence into v_seq;

  return format('%s-AS%s', v_project_number, lpad(v_seq::text, 2, '0'));
end;
$$;

-- =========================================================
-- Past-due invoice automation helper
-- =========================================================

create or replace function public.mark_past_due_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.invoices
  set status = 'past_due'
  where status in ('issued','sent','viewed','partial')
    and balance_due > 0
    and due_date is not null
    and due_date < current_date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =========================================================
-- Protect direct writes to audit log
-- =========================================================

drop policy if exists "authenticated activity read" on public.activity_log;

create policy "authenticated activity read"
on public.activity_log for select
to authenticated
using (true);

-- No general insert/update/delete policies are granted to authenticated users.
-- Server-side functions/service role should write audit records.

-- =========================================================
-- Replace broad write policies for sensitive tables
-- =========================================================

drop policy if exists "authenticated invoice access" on public.invoices;
drop policy if exists "authenticated invoice item access" on public.invoice_items;
drop policy if exists "authenticated payment access" on public.payments;
drop policy if exists "authenticated additional service access" on public.additional_services;
drop policy if exists "authenticated document access" on public.documents;
drop policy if exists "authenticated generated document access" on public.generated_documents;
drop policy if exists "authenticated delivery access" on public.document_deliveries;

create policy "invoice read internal"
on public.invoices for select
to authenticated
using (true);

create policy "invoice create authorized"
on public.invoices for insert
to authenticated
with check (public.has_role(array['owner_admin','project_manager','accounting']));

create policy "invoice update authorized"
on public.invoices for update
to authenticated
using (public.has_role(array['owner_admin','accounting']))
with check (public.has_role(array['owner_admin','accounting']));

create policy "invoice items read internal"
on public.invoice_items for select
to authenticated
using (true);

create policy "invoice items write authorized"
on public.invoice_items for all
to authenticated
using (public.has_role(array['owner_admin','project_manager','accounting']))
with check (public.has_role(array['owner_admin','project_manager','accounting']));

create policy "payments read internal"
on public.payments for select
to authenticated
using (true);

create policy "payments create authorized"
on public.payments for insert
to authenticated
with check (public.has_role(array['owner_admin','accounting']));

create policy "additional services read internal"
on public.additional_services for select
to authenticated
using (true);

create policy "additional services write authorized"
on public.additional_services for all
to authenticated
using (public.has_role(array['owner_admin','project_manager']))
with check (public.has_role(array['owner_admin','project_manager']));

create policy "documents read internal"
on public.documents for select
to authenticated
using (true);

create policy "documents write authorized"
on public.documents for all
to authenticated
using (public.has_role(array['owner_admin','project_manager','staff','accounting']))
with check (public.has_role(array['owner_admin','project_manager','staff','accounting']));

create policy "generated documents read internal"
on public.generated_documents for select
to authenticated
using (true);

create policy "generated documents create authorized"
on public.generated_documents for insert
to authenticated
with check (public.has_role(array['owner_admin','project_manager','accounting']));

create policy "deliveries read internal"
on public.document_deliveries for select
to authenticated
using (true);

create policy "deliveries create authorized"
on public.document_deliveries for insert
to authenticated
with check (public.has_role(array['owner_admin','project_manager','accounting']));

-- =========================================================
-- Staff restrictions for time entries
-- Staff can manage own unlocked time. Managers/Admin can manage all.
-- =========================================================

drop policy if exists "authenticated time access" on public.time_entries;

create policy "time read internal"
on public.time_entries for select
to authenticated
using (true);

create policy "time insert own or manager"
on public.time_entries for insert
to authenticated
with check (
  user_id = public.current_app_user_id()
  or public.has_role(array['owner_admin','project_manager'])
);

create policy "time update own or manager"
on public.time_entries for update
to authenticated
using (
  (user_id = public.current_app_user_id() and locked = false)
  or public.has_role(array['owner_admin','project_manager'])
)
with check (
  user_id = public.current_app_user_id()
  or public.has_role(array['owner_admin','project_manager'])
);

-- =========================================================
-- Expense restrictions
-- =========================================================

drop policy if exists "authenticated expense access" on public.expenses;

create policy "expense read internal"
on public.expenses for select
to authenticated
using (true);

create policy "expense insert internal"
on public.expenses for insert
to authenticated
with check (public.has_role(array['owner_admin','project_manager','staff','accounting']));

create policy "expense update authorized"
on public.expenses for update
to authenticated
using (
  locked = false
  and public.has_role(array['owner_admin','project_manager','staff','accounting'])
)
with check (public.has_role(array['owner_admin','project_manager','staff','accounting']));

-- =========================================================
-- Useful indexes
-- =========================================================

create index if not exists time_entries_project_date_idx
on public.time_entries(project_id, work_date);

create index if not exists expenses_project_date_idx
on public.expenses(project_id, expense_date);

create index if not exists invoices_project_status_idx
on public.invoices(project_id, status);

create index if not exists invoices_due_date_idx
on public.invoices(due_date)
where balance_due > 0;

create index if not exists activity_log_project_date_idx
on public.activity_log(project_id, created_at desc);
