import { describe, expect, it } from "vitest";
import { roundHoursUp } from "../src/lib/time-increments";

describe("half-hour time increments", () => {
  it.each([
    [0, 0],
    [0.01, 0.5],
    [0.5, 0.5],
    [0.51, 1],
    [1.49, 1.5],
    [1.5, 1.5],
    [7.76, 8],
  ])("rounds %s upward to %s", (entered, expected) => {
    expect(roundHoursUp(entered)).toBe(expected);
  });

  it("rejects negative and non-numeric values", () => {
    expect(() => roundHoursUp(-0.1)).toThrow();
    expect(() => roundHoursUp(Number.NaN)).toThrow();
  });
});
