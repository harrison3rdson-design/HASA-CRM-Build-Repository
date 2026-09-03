import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("customer proposal preview", () => {
  it("keeps production and source preview routes aligned", () => {
    expect(read("app/proposal-previews/[proposalId]/page.tsx"))
      .toBe(read("src/app/proposal-previews/[proposalId]/page.tsx"));
  });

  it("requires authentication and has no customer-delivery side effects", () => {
    const previewRoute = read("app/proposal-previews/[proposalId]/page.tsx");

    expect(previewRoute).toContain("await getCurrentAppUser()");
    expect(previewRoute).toContain("!appUser?.active");
    expect(previewRoute).toContain("redirect(\"/login\")");
    expect(previewRoute).toContain("<ProposalDocument");
    expect(previewRoute).toContain("<AcceptancePreviewCard");
    expect(previewRoute).not.toContain("getPublicProposalByToken");
    expect(previewRoute).not.toContain("proposal_share_links");
    expect(previewRoute).not.toContain("register_proposal_view");
    expect(previewRoute).not.toContain("<AcceptanceCard");
    expect(previewRoute).not.toContain("actionUrl");
  });

  it("uses one document component for both customer and internal views", () => {
    const publicRoute = read("app/public/proposals/[token]/page.tsx");
    const previewRoute = read("app/proposal-previews/[proposalId]/page.tsx");

    expect(publicRoute).toContain("<ProposalDocument");
    expect(previewRoute).toContain("<ProposalDocument");
  });
});

describe("proposal work and summary areas", () => {
  it("labels editable and read-only regions independently", () => {
    const proposalRoute = read("app/(app)/proposals/[proposalId]/page.tsx");

    expect(proposalRoute).toContain("Proposal Work Area");
    expect(proposalRoute).toContain("Proposal Summary");
    expect(proposalRoute).toContain("proposal-work-area");
    expect(proposalRoute).toContain("proposal-summary-area");
    expect(proposalRoute).toContain("Preview Customer View");
  });
});
