import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("direct client invoices", () => {
  const form = read("src/components/forms/invoice-form.tsx");
  const itemForm = read("src/components/forms/direct-invoice-item-form.tsx");
  const actions = read("src/app/actions/invoices.ts");
  const delivery = read("src/app/actions/invoice-delivery.ts");
  const detail = read("src/lib/data/detail-data.ts");
  const renderer = read("src/lib/invoices/render.ts");
  const migration = read("supabase/migrations/20261108130409_standalone_invoices.sql");

  it("requires a customer and billing contact without requiring a project", () => {
    expect(form).toContain("Direct client invoice — no approved project");
    expect(form).toContain('name="client_id"');
    expect(form).toContain('name="contact_id"');
    expect(actions).toContain('contactId = requiredText(formData.get("contact_id"), "Billing contact")');
    expect(actions).toContain('.eq("client_id", clientId)');
    expect(actions).toContain('invoiceType = invoiceMode === "standalone"');
  });

  it("adds and removes manual draft line items", () => {
    expect(itemForm).toContain("Professional service");
    expect(itemForm).toContain("Expense or material");
    expect(itemForm).toContain("Credit");
    expect(actions).toContain('invoice.invoice_type !== "standalone"');
    expect(actions).toContain("deleteInvoiceItemAction");
    expect(actions).toContain('admin.rpc("recalculate_invoice"');
  });

  it("supports direct numbering, nullable project linkage, and safe draft deletion", () => {
    expect(migration).toContain("alter column project_id drop not null");
    expect(migration).toContain("next_standalone_invoice_number");
    expect(migration).toContain("%s-DIRECT-%s");
    expect(migration).toContain("standalone_invoice_number_sequences");
    expect(migration).toContain("v_invoice.project_id is not null");
    expect(detail).toContain('.is("project_id", null)');
  });

  it("delivers to the invoice contact and stores PDFs outside project folders", () => {
    expect(delivery).toContain("normalizeRelatedContact(invoice.contact)");
    expect(delivery).toContain("Assign a billing contact");
    expect(delivery).toContain("total,status,locked");
    expect(renderer).toContain("Direct client invoice");
    expect(renderer).toContain("direct-invoices");
  });
});
