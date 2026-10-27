import { describe, it, expect } from "vitest";
import {
  parseServiceTerms,
  monthlyTotal,
  calendarMonthMinutes,
  safeModelUrl,
} from "../src/lib/services/terms";
import { calculateInvoiceDueDate } from "../src/lib/invoices/due-date";
import { readPublicAcceptance } from "../src/lib/security/public-request";
const terms = {
  name: "Portfolio 15",
  monthlyFee: 349,
  refreshMonthlyFee: 168.75,
  termMonths: 12,
  modelAllowance: 15,
  maintenanceMinutes: 60,
  scope:
    "Ten properties on Cedar Mountain. Transfer to client account on exit; retain 30 days.",
  refreshScope: "Five grouped local visits, up to 2500 sq ft each.",
};
describe("recurring service contracts", () => {
  it("keeps capture separate and calculates the agreed recurring commitment", () => {
    const parsed = parseServiceTerms(JSON.stringify(terms))!;
    expect(monthlyTotal(parsed)).toBe(517.75);
    expect(monthlyTotal(parsed) * parsed.termMonths).toBe(6213);
    expect(parseServiceTerms("")).toBeNull();
  });
  it.each([
    { monthlyFee: -1 },
    { monthlyFee: NaN },
    { termMonths: 1.5 },
    { termMonths: 0 },
    { modelAllowance: 0 },
    { scope: "" },
    { refreshScope: "" },
    { maintenanceMinutes: -30 },
  ])("rejects invalid or incomplete commercial terms %j", (patch) => {
    expect(() => parseServiceTerms({ ...terms, ...patch })).toThrow();
  });
  it("resets maintenance usage each calendar month without rolling time forward", () => {
    expect(
      calendarMonthMinutes(
        [
          { work_date: "2026-09-30", minutes: 45 },
          { work_date: "2026-10-01", minutes: 20 },
          { work_date: "2026-10-27", minutes: 30 },
        ],
        "2026-10-27",
      ),
    ).toBe(50);
  });
  it("only permits HTTPS model links without embedded credentials", () => {
    expect(safeModelUrl("https://my.matterport.com/show/?m=abc")).toContain(
      "m=abc",
    );
    for (const url of [
      "javascript:alert(1)",
      "http://example.com",
      "https://user:password@example.com",
    ])
      expect(() => safeModelUrl(url)).toThrow();
  });
  it("makes recurring invoices due on the Eastern calendar date sent", () => {
    expect(
      calculateInvoiceDueDate("2026-10-28T02:00:00Z", "Due on Receipt"),
    ).toBe("2026-10-27");
  });
  it("requires a literal recurring acknowledgement in customer acceptance input", async () => {
    const request = (value: unknown) =>
      new Request("https://example.com", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signerName: "Test Customer",
          recurringAccepted: value,
        }),
      });
    expect((await readPublicAcceptance(request(true))).recurringAccepted).toBe(
      true,
    );
    expect(
      (await readPublicAcceptance(request("true"))).recurringAccepted,
    ).toBe(false);
    expect(
      (await readPublicAcceptance(request(undefined))).recurringAccepted,
    ).toBe(false);
  });
});
