import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { proposalRevisionLabel } from "../src/lib/proposal-revisions";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("proposal version terminology", () => {
  it("shows the first stored version as the original proposal", () => {
    expect(proposalRevisionLabel(1)).toBe("Original Proposal");
    expect(proposalRevisionLabel(1, { compact: true })).toBe("Original");
  });

  it("starts customer-visible revision numbering after the original", () => {
    expect(proposalRevisionLabel(2)).toBe("Revision 1");
    expect(proposalRevisionLabel(3)).toBe("Revision 2");
  });

  it("uses the shared label in internal and customer-facing views", () => {
    expect(read("app/(app)/proposals/[proposalId]/page.tsx"))
      .toContain("proposalRevisionLabel");
    expect(read("app/(app)/clients/[clientId]/page.tsx"))
      .toContain("proposalRevisionLabel");
    expect(read("src/components/public/proposal-document.tsx"))
      .toContain("proposalRevisionLabel");
  });
});

describe("unissued draft proposal deletion", () => {
  const migration = read(
    "supabase/migrations/20260901141024_delete_unissued_draft_proposal.sql",
  );
  const permissionMigration = read(
    "supabase/migrations/20260901145151_grant_draft_deletion_sequence_access.sql",
  );

  it("checks external issuance rather than the mere existence of a link", () => {
    expect(migration).toContain("l.first_viewed_at is not null");
    expect(migration).toContain("l.last_delivery_at is not null");
    expect(migration).toContain("sent_at is not null");
    expect(migration).not.toContain("not exists (\n    select 1\n    from public.proposal_share_links");
  });

  it("releases only the latest current-year proposal number", () => {
    expect(migration).toContain("v_proposal_year <> v_current_year");
    expect(migration).toContain("last_sequence = v_proposal_sequence");
    expect(migration).toContain("v_proposal_sequence - 1");
  });

  it("protects sent, accepted, and project-linked proposals", () => {
    expect(migration).toContain("and locked");
    expect(migration).toContain("public.proposal_acceptances");
    expect(migration).toContain("public.projects");
    expect(migration).toContain("public.document_deliveries");
  });

  it("exposes the destructive action only through the authenticated server flow", () => {
    const action = read("src/app/actions/proposals.ts");
    const button = read("src/components/proposals/delete-proposal-button.tsx");
    const proposalPage = read("src/app/(app)/proposals/[proposalId]/page.tsx");

    expect(action).toContain("await Policies.proposalWrite()");
    expect(action).toContain('"delete_unissued_draft_proposal"');
    expect(button).toContain("Delete Draft Proposal");
    expect(button).toContain("window.confirm");
    expect(proposalPage).toContain(
      "d.proposal.proposal_number === d.latestAnnualProposalNumber",
    );
  });

  it("gives only the server role the private sequence access deletion requires", () => {
    expect(permissionMigration).toContain(
      "grant usage on schema private to service_role",
    );
    expect(permissionMigration).toContain(
      "grant select, update on table private.proposal_number_sequences to service_role",
    );
    expect(permissionMigration).not.toMatch(/\b(?:anon|authenticated|public)\b/);
  });
});
