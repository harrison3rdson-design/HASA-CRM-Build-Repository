import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("manual proposal authorization recovery", () => {
  it("stores the authorization source, staff recorder, notes, and private evidence", () => {
    const migration = read("supabase/migrations/20260902213000_manual_proposal_authorizations.sql");

    expect(migration).toContain("authorization_method in ('electronic', 'verbal', 'email')");
    expect(migration).toContain("recorded_by uuid references public.app_users(id)");
    expect(migration).toContain("evidence_document_id uuid references public.documents(id) on delete restrict");
    expect(migration).toContain("p_authorization_method = 'email' and p_evidence_document_id is null");
    expect(migration).toContain("proposal.manually_accepted");
  });

  it("accepts only the current sent and locked proposal version and creates the project once", () => {
    const migration = read("supabase/migrations/20260902213000_manual_proposal_authorizations.sql");

    expect(migration).toContain("v_proposal.current_revision <> v_revision.revision_number");
    expect(migration).toContain("v_proposal.status not in ('sent', 'viewed', 'changes_requested') or not v_revision.locked");
    expect(migration).toContain("where source_revision_id = v_revision.id");
    expect(migration).toContain("set status = 'accepted'");
    expect(migration).toContain("update public.proposal_share_links");
  });

  it("provides management UI for verbal or email authorization with required email evidence", () => {
    const form = read("src/components/proposals/manual-proposal-authorization-form.tsx");
    const page = read("src/app/(app)/proposals/[proposalId]/page.tsx");

    expect(form).toContain('<option value="verbal">Verbal</option>');
    expect(form).toContain('<option value="email">Email</option>');
    expect(form).toContain('required={method === "email"}');
    expect(form).toContain("Record Manual Authorization");
    expect(page).toContain("Authorization Recovery");
    expect(page).toContain("Customer Authorization Records");
    expect(page).toContain("/api/documents/${evidence.id}/download");
  });

  it("keeps prior customer links usable when a resend fails and replaces them after success", () => {
    const send = read("src/app/actions/send-documents.ts");
    const button = read("src/components/proposals/send-proposal-button.tsx");

    expect(send).toContain("{ revokeExisting: !isResend }");
    expect(send).toContain("The previous customer link remains available");
    expect(send).toContain('.neq("token_hash", tokenHash)');
    expect(button).toContain("Resend Proposal");
  });

  it("keeps duplicate proposal and evidence routes aligned", () => {
    expect(read("app/(app)/proposals/[proposalId]/page.tsx"))
      .toBe(read("src/app/(app)/proposals/[proposalId]/page.tsx"));
    expect(read("app/api/documents/[documentId]/download/route.ts"))
      .toBe(read("src/app/api/documents/[documentId]/download/route.ts"));
  });
});
