import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const form = readFileSync("src/components/forms/invoice-form.tsx", "utf8");
const action = readFileSync("src/app/actions/invoices.ts", "utf8");
const detail = readFileSync("src/app/(app)/billing/[invoiceId]/page.tsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260902200956_distinct_invoice_workflows.sql",
  "utf8",
);

describe("distinct invoice workflows", () => {
  it("builds an Advance from an amount or percentage without claiming project activity", () => {
    expect(form).toContain('value="advance"');
    expect(form).toContain('name="advance_method"');
    expect(form).toContain('name="advance_value"');
    expect(form).toContain("Time and expenses are not pulled into an Advance invoice");
    expect(migration).toContain("v_context.service_fee_authorized * p_advance_value / 100");
  });

  it("lets Progress invoices claim time, expenses, or both exactly once", () => {
    expect(form).toContain('name="include_time"');
    expect(form).toContain('name="include_expenses"');
    expect(action).toContain('admin.rpc("build_invoice_workflow"');
    expect(migration).toContain("invoice_item_id is null");
    expect(migration).toContain("for update");
  });

  it("reconciles a fixed-fee Final invoice and exposes prior billings", () => {
    expect(migration).toContain("Final authorized service balance");
    expect(migration).toContain("prior_invoice.status <> 'void'");
    expect(migration).toContain("p_zero_time_amount then 0");
    expect(detail).toContain("Final Invoice Reconciliation");
    expect(detail).toContain("Prior Project Invoices");
  });

  it("limits newly created invoices to the three supported workflows", () => {
    expect(form).not.toContain('value="milestone"');
    expect(form).not.toContain('value="hourly"');
    expect(form).not.toContain('value="expense"');
    expect(form).not.toContain('value="credit"');
    expect(action).toContain('["advance", "progress", "final"]');
  });
});
