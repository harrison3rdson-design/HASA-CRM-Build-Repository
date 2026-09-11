import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateAlternateSelection,
  type ProposalAlternate,
  validateAlternateConfiguration,
} from "../src/lib/proposal-alternates";
import { PublicRequestError, readPublicAcceptance } from "../src/lib/security/public-request";

const ALTERNATES: ProposalAlternate[] = [
  {
    alternate_key: "residential",
    title: "Missing Residential Areas",
    alternate_type: "independent",
    amount: 4500,
  },
  {
    alternate_key: "details",
    title: "Residential Detail Set",
    alternate_type: "dependent",
    amount: 1200,
    required_alternate_key: "residential",
  },
  {
    alternate_key: "commercial",
    title: "Commercial Areas",
    alternate_type: "independent",
    amount: 7500,
  },
  {
    alternate_key: "complete",
    title: "Complete Resort Bundle",
    alternate_type: "bundle",
    amount: 10000,
    bundle_component_keys: ["residential", "details", "commercial"],
  },
];

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("proposal alternate selection rules", () => {
  it("keeps base scope required and calculates the accepted contract total", () => {
    const selection = calculateAlternateSelection(
      ALTERNATES,
      ["residential", "details"],
      18_500,
    );

    expect(selection.selectedKeys).toEqual(["residential", "details"]);
    expect(selection.declined.map((alternate) => alternate.alternate_key))
      .toEqual(["commercial", "complete"]);
    expect(selection.alternateTotal).toBe(5700);
    expect(selection.acceptedTotal).toBe(24_200);
  });

  it("rejects a dependent alternate unless its prerequisite is selected", () => {
    expect(() => calculateAlternateSelection(ALTERNATES, ["details"], 18_500))
      .toThrow(/requires another alternate/i);
  });

  it("rejects selecting a bundle with any component alternate", () => {
    expect(() => calculateAlternateSelection(ALTERNATES, ["complete", "commercial"], 18_500))
      .toThrow(/cannot be selected/i);
  });

  it("rejects malformed bundle and dependency configurations", () => {
    expect(() => validateAlternateConfiguration([
      { ...ALTERNATES[1], required_alternate_key: "missing" },
    ])).toThrow(/must require another alternate/i);
    expect(() => validateAlternateConfiguration([
      ALTERNATES[0],
      { ...ALTERNATES[3], bundle_component_keys: ["residential", "residential"] },
    ])).toThrow(/unique component alternates/i);
  });
});

describe("public acceptance input", () => {
  it("accepts normalized alternate keys", async () => {
    const request = new Request("https://example.test/api/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        signerName: "Customer Approver",
        signerEmail: "approver@example.test",
        selectedAlternateKeys: ["residential", "details"],
      }),
    });

    await expect(readPublicAcceptance(request)).resolves.toMatchObject({
      selectedAlternateKeys: ["residential", "details"],
    });
  });

  it("rejects duplicate or malformed alternate keys", async () => {
    for (const keys of [["residential", "residential"], ["not a safe key"]]) {
      const request = new Request("https://example.test/api/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signerName: "Customer Approver", selectedAlternateKeys: keys }),
      });
      await expect(readPublicAcceptance(request)).rejects.toBeInstanceOf(PublicRequestError);
    }
  });
});

describe("immutable accepted proposal package", () => {
  it("persists a locked snapshot, final document, and accepted total atomically", () => {
    const migration = read("supabase/migrations/20260911153611_proposal_alternates_acceptance_snapshot.sql");
    expect(migration).toContain("accepted_snapshot");
    expect(migration).toContain("accepted_total");
    expect(migration).toContain("selected_alternate_keys");
    expect(migration).toContain("insert into public.generated_documents");
    expect(migration).toContain("prevent_executed_contract_changes");
  });

  it("renders choices and terms in the PDF and emails it to customer and HASA", () => {
    const html = read("src/lib/documents/executed-html.ts");
    const delivery = read("src/lib/delivery/accepted-proposal-package.ts");
    expect(html).toContain("Selected Alternates");
    expect(html).toContain("Declined Alternates");
    expect(html).toContain("Proposal Terms and Conditions");
    expect(html).toContain("Acceptance ID");
    expect(delivery).toContain("attachments:");
    expect(delivery).toContain('{ kind: "customer"');
    expect(delivery).toContain('{ kind: "hasa"');
  });

  it("keeps mirrored public acceptance and proposal pages synchronized", () => {
    expect(read("app/api/public/proposals/[token]/accept/route.ts"))
      .toBe(read("src/app/api/public/proposals/[token]/accept/route.ts"));
    expect(read("app/public/proposals/[token]/page.tsx"))
      .toBe(read("src/app/public/proposals/[token]/page.tsx"));
    expect(read("app/proposal-previews/[proposalId]/page.tsx"))
      .toBe(read("src/app/proposal-previews/[proposalId]/page.tsx"));
    expect(read("app/(app)/proposals/[proposalId]/page.tsx"))
      .toBe(read("src/app/(app)/proposals/[proposalId]/page.tsx"));
  });
});
