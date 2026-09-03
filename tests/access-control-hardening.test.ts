import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("phase 1 access-control hardening", () => {
  it("requires an active application user before evaluating a role", () => {
    const server = source("src/lib/auth/server.ts");
    const requireRole = source("src/lib/auth/require-role.ts");
    const layout = source("app/(app)/layout.tsx");

    expect(server).toContain("export async function requireActiveUser()");
    expect(server).toContain("if (!appUser?.active)");
    expect(requireRole).toContain("await requireActiveUser()");
    expect(layout).toContain("getCurrentAppUser");
    expect(layout).toContain("!appUser?.active");
  });

  it("authorizes every privileged server-action group through named policies", () => {
    const expectations: Array<[string, string]> = [
      ["src/app/actions/clients.ts", "Policies.clientWrite"],
      ["src/app/actions/additional-services.ts", "Policies.projectWrite"],
      ["src/app/actions/proposals.ts", "Policies.proposalWrite"],
      ["src/app/actions/send-documents.ts", "Policies.proposalSend"],
      ["src/app/actions/time.ts", "Policies.timeOwn"],
      ["src/app/actions/expenses.ts", "Policies.expenseWrite"],
      ["src/app/actions/documents.ts", "Policies.documentWrite"],
      ["src/app/actions/invoices.ts", "Policies.invoiceCreate"],
      ["src/app/actions/invoice-delivery.ts", "Policies.invoiceIssue"],
    ];

    for (const [path, policy] of expectations) {
      const action = source(path);
      expect(action, path).toContain(policy);
      expect(action, path).not.toContain("requireUser(");
    }
  });

  it("guards privileged data loaders before using the service-role client", () => {
    for (const path of ["src/lib/data/app-data.ts", "src/lib/data/detail-data.ts"]) {
      const loader = source(path);
      expect(loader, path).toContain("Policies.internalRead");
      expect(loader, path).toContain("createAdminClient");
    }
  });

  it("removes obsolete scaffold and arbitrary storage-signing endpoints", () => {
    const removedRoutes = [
      "app/api/proposals/[proposalId]/send/route.ts",
      "app/api/additional-services/[authorizationId]/send/route.ts",
      "app/api/invoices/[invoiceId]/generate/route.ts",
      "app/api/invoices/[invoiceId]/send/route.ts",
      "app/api/invoices/[invoiceId]/payments/route.ts",
      "app/api/projects/[projectId]/time/route.ts",
      "app/api/projects/[projectId]/expenses/route.ts",
      "app/api/projects/[projectId]/invoices/route.ts",
      "app/api/storage/sign/route.ts",
      "app/api/storage/upload/route.ts",
    ];

    for (const path of removedRoutes) {
      expect(existsSync(resolve(path)), path).toBe(false);
    }
  });

  it("moves role helpers out of the exposed public schema and replaces broad policies", () => {
    const migration = source(
      "supabase/migrations/20260903141334_phase1_access_control_hardening.sql",
    );

    expect(migration).toContain("private.has_role");
    expect(migration).toContain("drop function public.has_role(text[])");
    expect(migration).not.toContain("using (true)");
    expect(migration).not.toContain("with check (true)");
  });
});
