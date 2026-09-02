import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateExpenseAmount, calculateLaborAmount } from "../src/lib/proposal-items";
import { roundHoursUp } from "../src/lib/time-increments";

describe("itemized Additional Services", () => {
  it("rounds labor up to half-hours and calculates the authorization total", () => {
    const laborAmount = calculateLaborAmount(roundHoursUp(1.25), 200);
    const expenseAmount = calculateExpenseAmount(2, 50, 10, "actual_plus_markup");
    expect(laborAmount).toBe(300);
    expect(expenseAmount).toBe(110);
    expect(laborAmount + expenseAmount).toBe(410);
  });

  it("requires itemized categories and calculates the parent amount from them", () => {
    const parser = readFileSync(resolve("src/lib/additional-service-items.ts"), "utf8");
    const action = readFileSync(resolve("src/app/actions/additional-services.ts"), "utf8");
    expect(parser).toContain("Add at least one labor or expense line");
    expect(parser).toContain("authorizedAmount");
    expect(action).toContain("create_additional_service_draft");
    expect(action).not.toContain('formData.get("authorized_amount")');
  });
});

describe("approved-work invoice chain", () => {
  it("exposes accepted Additional Service categories and builds invoices only from unbilled entries", () => {
    const data = readFileSync(resolve("src/lib/data/app-data.ts"), "utf8");
    const migration = readFileSync(
      resolve("supabase/migrations/20260902193000_additional_service_items_and_invoice_builder.sql"),
      "utf8",
    );
    const invoiceForm = readFileSync(resolve("src/components/forms/invoice-form.tsx"), "utf8");

    expect(data).toContain('.eq("status", "accepted")');
    expect(data).toContain('source_kind: "additional_service"');
    expect(migration).toContain("invoice_item_id is null");
    expect(migration).toContain("for update");
    expect(migration).toContain("build_invoice_from_unbilled");
    expect(invoiceForm).toContain("Build from Unbilled Time and Expenses");
  });
});
