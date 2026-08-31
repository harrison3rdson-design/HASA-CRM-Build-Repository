import { describe, expect, it } from "vitest";
import { PAYMENT_TERMS, parsePaymentTerms } from "../src/lib/payment-terms";

describe("payment terms", () => {
  it("accepts every supported option", () => {
    expect(PAYMENT_TERMS.map((terms) => parsePaymentTerms(terms))).toEqual([
      "NET 15",
      "NET 30",
      "NET 90",
    ]);
  });

  it("rejects unsupported or missing terms", () => {
    expect(() => parsePaymentTerms("NET 45")).toThrow(/NET 15, NET 30, or NET 90/);
    expect(() => parsePaymentTerms(null)).toThrow(/NET 15, NET 30, or NET 90/);
  });
});
