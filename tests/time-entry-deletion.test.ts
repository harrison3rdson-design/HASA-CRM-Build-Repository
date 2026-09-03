import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("safe time-entry deletion", () => {
  it("requires authentication, authorization, and an unlocked unbilled entry", () => {
    const action = read("src/app/actions/time.ts");

    expect(action).toContain("await Policies.timeOwn()");
    expect(action).toContain('["owner_admin", "project_manager"]');
    expect(action).toContain('entry.user_id !== user.id');
    expect(action).toContain('.eq("locked", false)');
    expect(action).toContain('.is("invoice_item_id", null)');
  });

  it("offers deletion from project and time views only for eligible entries", () => {
    const project = read("src/app/(app)/projects/[projectId]/page.tsx");
    const time = read("src/app/(app)/time/page.tsx");
    const button = read("src/components/time/delete-time-entry-button.tsx");

    expect(project).toContain("!t.locked && !t.invoice_item_id");
    expect(time).toContain("!x.locked && !x.invoice_item_id");
    expect(button).toContain("window.confirm");
    expect(button).toContain("This cannot be undone");
  });
});
