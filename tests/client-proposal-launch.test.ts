import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("client-scoped proposal creation", () => {
  it("keeps the production and source client routes aligned", () => {
    expect(read("app/(app)/clients/[clientId]/page.tsx"))
      .toBe(read("src/app/(app)/clients/[clientId]/page.tsx"));
  });

  it("keeps the production and source new-proposal routes aligned", () => {
    expect(read("app/(app)/proposals/new/page.tsx"))
      .toBe(read("src/app/(app)/proposals/new/page.tsx"));
  });

  it("launches a proposal from the client with the client identifier", () => {
    const clientRoute = read("app/(app)/clients/[clientId]/page.tsx");

    expect(clientRoute).toContain("New Proposal for Client");
    expect(clientRoute).toContain("/proposals/new?clientId=${clientId}");
  });

  it("preselects the client and its current primary contact", () => {
    const newProposalRoute = read("app/(app)/proposals/new/page.tsx");
    const proposalForm = read("src/components/forms/proposal-form.tsx");

    expect(newProposalRoute).toContain("const { clientId } = await searchParams");
    expect(newProposalRoute).toContain("selectDefaultProposalContact(inheritedClient?.contacts ?? [])");
    expect(newProposalRoute).toContain("initialClientId={initialClientId}");
    expect(newProposalRoute).toContain("initialContactId={initialContactId}");
    expect(proposalForm).toContain("useState(initialClientId)");
    expect(proposalForm).toContain("useState(initialContactId)");
    expect(proposalForm).toContain("Client details inherited");
  });
});

describe("client invoice history", () => {
  it("loads invoices by client and includes project context", () => {
    const detailData = read("src/lib/data/detail-data.ts");

    expect(detailData).toContain('s.from("invoices")');
    expect(detailData).toContain('.eq("client_id", clientId)');
    expect(detailData).toContain('project:projects(project_number,project_name)');
  });

  it("shows linked invoice totals, balances, and status on the client screen", () => {
    const clientRoute = read("app/(app)/clients/[clientId]/page.tsx");

    expect(clientRoute).toContain('<Panel title="Invoices">');
    expect(clientRoute).toContain('href={`/billing/${invoice.id}`}');
    expect(clientRoute).toContain("money(invoice.total)");
    expect(clientRoute).toContain("money(invoice.balance_due)");
    expect(clientRoute).toContain("No invoices have been created for this client.");
  });
});
