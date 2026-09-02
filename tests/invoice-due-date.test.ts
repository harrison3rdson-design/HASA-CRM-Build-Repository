import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateInvoiceDueDate,
  getPaymentTermDays,
} from "../src/lib/invoices/due-date";

describe("invoice due dates", () => {
  it.each([
    ["NET 15", 15, "2026-09-17"],
    ["NET 30", 30, "2026-10-02"],
    ["NET 90", 90, "2026-12-01"],
  ] as const)("calculates %s from the customer send date", (terms, days, expected) => {
    expect(getPaymentTermDays(terms)).toBe(days);
    expect(calculateInvoiceDueDate("2026-09-02T18:00:00.000Z", terms)).toBe(expected);
  });

  it("uses the Eastern calendar date when delivery occurs near midnight", () => {
    expect(calculateInvoiceDueDate("2026-09-02T03:30:00.000Z", "NET 30"))
      .toBe("2026-10-01");
  });

  it("rejects unsupported terms and invalid dates", () => {
    expect(() => calculateInvoiceDueDate("2026-09-02T18:00:00.000Z", "NET 45"))
      .toThrow(/NET 15, NET 30, or NET 90/);
    expect(() => calculateInvoiceDueDate("not-a-date", "NET 15"))
      .toThrow(/sent date is invalid/);
  });

  it("does not accept a manual due date on a new invoice", () => {
    const form = readFileSync("src/components/forms/invoice-form.tsx", "utf8");
    const createAction = readFileSync("src/app/actions/invoices.ts", "utf8");

    expect(form).not.toContain('name="due_date"');
    expect(form).toContain("Calculated when sent");
    expect(createAction).toContain("due_date: null");
  });

  it("persists the send timestamp and calculated due date only after delivery", () => {
    const delivery = readFileSync("src/app/actions/invoice-delivery.ts", "utf8");

    expect(delivery).toContain("calculateInvoiceDueDate(sentAt, invoice.payment_terms)");
    expect(delivery).toContain('result.status === "sent" || result.status === "delivered"');
    expect(delivery).toContain('sent_at:sentAt.toISOString(),due_date:dueDate');
  });

  it("enforces the same calculation in the database", () => {
    const migration = readFileSync(
      "supabase/migrations/20260902194940_calculate_invoice_due_date_when_sent.sql",
      "utf8",
    );

    expect(migration).toContain("before insert or update of sent_at, payment_terms, due_date");
    expect(migration).toContain("timezone('America/New_York', p_sent_at)::date + v_days");
    expect(migration).toContain("where sent_at is null");
  });
});
