import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  calculateExpenseAmount,
  calculateLaborAmount,
  calculateMaterialAmount,
  calculateMaterialUnitPrice,
  parseExpenseBillingRule,
  roundMoney,
} from "../src/lib/proposal-items";

describe("proposal item calculations", () => {
  it("calculates labor from hours and hourly rate", () => {
    expect(calculateLaborAmount(12.5, 185)).toBe(2312.5);
  });

  it("applies markup only to actual-plus-markup expenses", () => {
    expect(calculateExpenseAmount(2, 500, 15, "actual_plus_markup")).toBe(1150);
    expect(calculateExpenseAmount(2, 500, 15, "actual")).toBe(1000);
  });

  it("prices materials with optional markup", () => {
    expect(calculateMaterialUnitPrice(80, 25)).toBe(100);
    expect(calculateMaterialAmount(3, 80, 25)).toBe(300);
    expect(calculateMaterialAmount(3, 80, 0)).toBe(240);
  });

  it("does not add included or non-billable expenses to the estimate", () => {
    expect(calculateExpenseAmount(1, 750, 0, "included")).toBe(0);
    expect(calculateExpenseAmount(1, 750, 0, "not_billable")).toBe(0);
  });

  it("rounds monetary totals to cents", () => {
    expect(roundMoney(10.005)).toBe(10.01);
  });

  it("rejects unsupported expense billing rules", () => {
    expect(parseExpenseBillingRule("actual")).toBe("actual");
    expect(() => parseExpenseBillingRule("whatever")).toThrow(/invalid/);
  });
});

describe("new proposal validation", () => {
  const action = readFileSync(resolve("src/app/actions/proposals.ts"), "utf8");
  const form = readFileSync(resolve("src/components/forms/proposal-form.tsx"), "utf8");
  const lineItems = readFileSync(
    resolve("src/components/forms/proposal-line-items-fields.tsx"),
    "utf8",
  );

  it("returns expected validation messages to the form instead of an error page", () => {
    expect(action).toContain('return { status: "error", message: validationErrorMessage(error) }');
    expect(form).toContain("useActionState(createProposalAction");
    expect(form).toContain('className="form-message error" role="alert"');
  });

  it("requires all labor fields only after a labor line has been started", () => {
    expect(lineItems).toContain("const laborLineStarted = Boolean");
    expect(lineItems.match(/required=\{laborLineStarted\}/g)).toHaveLength(3);
  });

  it("provides a dedicated proposal materials area without exposing cost in the customer document", () => {
    const customerDocument = readFileSync(
      resolve("src/components/public/proposal-document.tsx"),
      "utf8",
    );
    expect(lineItems).toContain("Add Material Line");
    expect(lineItems).toContain("Bid Unit Price");
    expect(lineItems).toContain('name={`material_markup_${index}`}');
    expect(customerDocument).toContain("<h2>Materials</h2>");
    expect(customerDocument).toContain("material.unit_price");
    expect(customerDocument).not.toContain("material.unit_cost");
    expect(customerDocument).not.toContain("material.markup_percent");
  });
});

describe("proposal material persistence", () => {
  const migration = readFileSync(
    resolve("supabase/migrations/20260903090000_proposal_materials.sql"),
    "utf8",
  );
  const action = readFileSync(resolve("src/app/actions/proposals.ts"), "utf8");

  it("stores materials independently and includes them in the proposal total", () => {
    expect(migration).toContain("create table public.proposal_material_items");
    expect(migration).toContain("professional_fee + estimated_materials + estimated_expenses");
    expect(action).toContain('admin.rpc("update_proposal_revision_draft_v3"');
    expect(action).toContain('copyChildren("proposal_material_items"');
  });

  it("makes accepted materials available to project expense and invoice processing", () => {
    expect(migration).toContain("source_material_id");
    expect(migration).toContain("The selected material is not part of the accepted proposal.");
  });
});
