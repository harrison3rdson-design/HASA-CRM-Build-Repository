import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("unissued draft invoice deletion", () => {
  const migration = read(
    "supabase/migrations/20260902174254_delete_unissued_draft_invoice.sql",
  );

  it("protects issued, locked, delivered, and paid invoices", () => {
    expect(migration).toContain("v_invoice.status <> 'draft'");
    expect(migration).toContain("v_invoice.locked");
    expect(migration).toContain("v_invoice.issued_at is not null");
    expect(migration).toContain("public.document_deliveries");
    expect(migration).toContain("public.payments");
  });

  it("releases only the latest project invoice number", () => {
    expect(migration).toContain("public.invoice_number_sequences");
    expect(migration).toContain("last_sequence = v_invoice_sequence");
    expect(migration).toContain("v_invoice_sequence - 1");
  });

  it("returns linked draft time, expenses, and schedules to the project", () => {
    expect(migration).toContain("update public.time_entries");
    expect(migration).toContain("update public.expenses");
    expect(migration).toContain("update public.billing_schedules");
    expect(migration).toContain("set invoice_item_id = null");
    expect(migration).toContain("set invoice_id = null");
  });

  it("exposes the destructive action through an authorized confirmed UI flow", () => {
    const action = read("src/app/actions/invoices.ts");
    const button = read("src/components/billing/delete-invoice-button.tsx");
    const invoicePage = read("src/app/(app)/billing/[invoiceId]/page.tsx");

    expect(action).toContain("await Policies.invoiceWrite()");
    expect(action).toContain('"delete_unissued_draft_invoice"');
    expect(button).toContain("Delete Draft Invoice");
    expect(button).toContain("window.confirm");
    expect(invoicePage).toContain("latestProjectInvoiceNumber");
  });

  it("keeps the RPC private to the server role", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
