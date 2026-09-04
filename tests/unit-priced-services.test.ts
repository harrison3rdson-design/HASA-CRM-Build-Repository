import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260904223039_unit_priced_services.sql");
const proposalAction = read("src/app/actions/proposals.ts");
const timeAction = read("src/app/actions/time.ts");
const projectData = read("src/lib/data/app-data.ts");
const projectPage = read("src/app/(app)/projects/[projectId]/page.tsx");

describe("unit-priced services", () => {
  it("stores the pricing basis, quantity, unit, rate, and calculated amount", () => {
    expect(proposalAction).toContain("billing_type: billingType");
    expect(proposalAction).toContain("calculateServiceAmount(billingType, quantity, rate)");
    expect(migration).toContain("update_proposal_revision_draft_v5");
    expect(migration).toContain("fee.billing_type not in ('hourly', 'unit', 'fixed', 'included')");
    expect(migration).toContain("round(fee.quantity * fee.rate, 2)");
  });

  it("keeps non-hourly services out of Time Entry", () => {
    expect(projectData).toContain('.eq("billing_type", "hourly")');
    expect(timeAction).toContain('.eq("billing_type", "hourly")');
  });

  it("records approved per-unit work inside the project", () => {
    expect(projectPage).toContain('title="Per-Unit Work"');
    expect(projectPage).toContain("<UnitServiceEntryForm");
    expect(projectPage).toContain("<DeleteUnitServiceEntryButton");
  });

  it("protects unit work with role-based access and row-level security", () => {
    expect(migration).toContain("alter table public.unit_service_entries enable row level security");
    expect(migration).toContain("revoke all on public.unit_service_entries from public, anon");
    expect(migration).toContain('create policy "unit service entries create authorized"');
    expect(migration).toContain("Only approved per-unit services can be recorded here.");
  });

  it("keeps duplicated production routes aligned", () => {
    expect(read("app/(app)/projects/[projectId]/page.tsx")).toBe(projectPage);
    expect(read("app/(app)/proposals/[proposalId]/page.tsx"))
      .toBe(read("src/app/(app)/proposals/[proposalId]/page.tsx"));
    expect(read("app/(app)/billing/[invoiceId]/page.tsx"))
      .toContain('i.unit??"item"');
  });
});
