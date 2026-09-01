import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("public privacy and terms pages", () => {
  it("includes the required SMS privacy disclosures", () => {
    const privacy = read("app/privacy/page.tsx");

    expect(privacy).toContain("mobile phone numbers or SMS opt-in and consent information");
    expect(privacy).toContain("Message frequency varies");
    expect(privacy).toMatch(/Message and data rates may\s+apply/);
    expect(privacy).toContain("STOP");
    expect(privacy).toContain("HELP");
  });

  it("includes the required SMS program terms", () => {
    const terms = read("app/terms/page.tsx");

    expect(terms).toContain("HASA Concepts Customer Communications");
    expect(terms).toContain("verbal consent");
    expect(terms).toContain("not a condition of purchasing goods or services");
    expect(terms).toContain('href="/privacy"');
  });

  it("links customer-facing proposals to both public policies", () => {
    const proposalDocument = read("src/components/public/proposal-document.tsx");

    expect(proposalDocument).toContain('href="/privacy"');
    expect(proposalDocument).toContain('href="/terms"');
  });
});
