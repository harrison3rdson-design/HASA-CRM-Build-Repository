import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { STANDARD_PROPOSAL_TERMS } from "../src/lib/proposal-terms";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("standard proposal terms", () => {
  it("uses the approved consulting and North Carolina language", () => {
    expect(STANDARD_PROPOSAL_TERMS).toContain(
      "fire, life safety, and emergency communications systems",
    );
    expect(STANDARD_PROPOSAL_TERMS).toContain(
      "NICET Level IV certification in Fire Alarm Systems",
    );
    expect(STANDARD_PROPOSAL_TERMS).toContain(
      "not engaged under this Agreement to provide professional engineering services",
    );
    expect(STANDARD_PROPOSAL_TERMS).toContain("Cherokee County, North Carolina");
    expect(STANDARD_PROPOSAL_TERMS).toContain("21. Miscellaneous");
  });

  it("adds configurable settings and a revision snapshot without retroactively changing locked proposals", () => {
    const migration = read("supabase/migrations/20260904160000_add_standard_proposal_terms.sql");

    expect(migration).toContain("default_proposal_terms text");
    expect(migration).toContain("proposal_terms text");
    expect(migration).toContain("update_proposal_revision_draft_v4");
    expect(migration).not.toMatch(/update public\.proposal_revisions\s+set proposal_terms[\s\S]+where locked = true/i);
  });

  it("copies and validates terms throughout proposal creation and revision editing", () => {
    const actions = read("src/app/actions/proposals.ts");
    const settingsAction = read("src/app/actions/settings.ts");
    const settingsForm = read("src/components/forms/settings-form.tsx");
    const revisionForm = read("src/components/forms/proposal-revision-form.tsx");
    const sendAction = read("src/app/actions/send-documents.ts");

    expect(actions).toContain("proposal_terms: proposalTerms");
    expect(actions).toContain("current.proposal_terms ?? settings.default_proposal_terms");
    expect(actions).toContain('rpc("update_proposal_revision_draft_v4"');
    expect(settingsAction).toContain("default_proposal_terms: parseProposalTerms");
    expect(settingsForm).toContain("Default Proposal Terms and Conditions");
    expect(revisionForm).toContain('name="proposal_terms"');
    expect(sendAction).toContain("if (isInitialSend && !revision.proposal_terms)");
  });

  it("renders the preserved terms in customer views and as the last executed-PDF section", () => {
    const customerDocument = read("src/components/public/proposal-document.tsx");
    const publicCss = read("src/styles/public.css");
    const executedPdf = read("src/lib/documents/executed-html.ts");

    expect(customerDocument).toContain("proposal-terms-page");
    expect(customerDocument).toContain("revision.proposal_terms");
    expect(publicCss).toContain("page-break-before:always");
    expect(executedPdf).toContain("proposalTermsSection");
    expect(executedPdf.indexOf("${new Date().toISOString()}</div>"))
      .toBeLessThan(executedPdf.indexOf("${proposalTermsSection}"));
  });
});
