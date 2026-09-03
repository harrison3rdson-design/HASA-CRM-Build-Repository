import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("proposal validity", () => {
  it("defaults new proposals to 90 editable days", () => {
    const proposalForm = read("src/components/forms/proposal-form.tsx");

    expect(proposalForm).toContain('name="validity_days"');
    expect(proposalForm).toContain('defaultValue="90"');
    expect(proposalForm).not.toContain('defaultValue="15"');
  });

  it("keeps the database fallback aligned", () => {
    const migration = read("supabase/migrations/20260903092000_default_proposal_validity_90.sql");

    expect(migration).toContain("alter column validity_days set default 90");
  });
});
