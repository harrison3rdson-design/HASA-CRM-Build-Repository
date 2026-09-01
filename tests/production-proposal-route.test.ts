import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("production proposal route", () => {
  it("stays aligned with the editable proposal implementation", () => {
    const productionRoute = readFileSync(
      resolve("app/(app)/proposals/[proposalId]/page.tsx"),
      "utf8",
    );
    const editableRoute = readFileSync(
      resolve("src/app/(app)/proposals/[proposalId]/page.tsx"),
      "utf8",
    );

    expect(productionRoute).toBe(editableRoute);
  });
});
