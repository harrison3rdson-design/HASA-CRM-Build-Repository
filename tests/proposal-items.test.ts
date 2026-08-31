import { describe, expect, it } from "vitest";
import {
  calculateExpenseAmount,
  calculateLaborAmount,
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
