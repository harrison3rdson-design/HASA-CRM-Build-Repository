import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("customer approval confirmation", () => {
  it("keeps customer entries on errors and replaces the form with a clear receipt on success", () => {
    const card = read("src/components/public/acceptance-card.tsx");

    expect(card).toContain("event.preventDefault()");
    expect(card).toContain("Your approval was successful");
    expect(card).toContain("No further action is required");
    expect(card).toContain("Approval date");
    expect(card).not.toContain("<form action={submit}");
  });

  it("returns receipt details from both public acceptance routes", () => {
    for (const path of [
      "app/api/public/proposals/[token]/accept/route.ts",
      "app/api/public/additional-services/[token]/accept/route.ts",
    ]) {
      const route = read(path);
      expect(route).toContain("acceptedAt: new Date().toISOString()");
      expect(route).toContain("signerName: String(signer.signerName).trim()");
      expect(route).toContain("reference:");
    }
  });

  it("shows approval identity and date in the internal proposal UI", () => {
    const proposal = read("app/(app)/proposals/[proposalId]/page.tsx");

    expect(proposal).toContain("Customer Authorization Records");
    expect(proposal).toContain("Approved By");
    expect(proposal).toContain("Approval Date");
    expect(proposal).toContain("signer_email");
  });
});

describe("project-scoped operations", () => {
  it("makes project rows actionable", () => {
    const projects = read("app/(app)/projects/page.tsx");
    expect(projects).toContain("/projects/${project.project_id}");
    expect(projects).toContain('className="table-link"');
  });

  it("launches time, expense, and invoice work with an inherited project", () => {
    const project = read("app/(app)/projects/[projectId]/page.tsx");
    expect(project).toContain("/time?projectId=${projectId}#add-time");
    expect(project).toContain("/expenses?projectId=${projectId}#add-expense");
    expect(project).toContain("/billing/new?projectId=${projectId}");
    expect(project).toContain("Review originating proposal and approval");

    expect(read("src/components/forms/manual-time-form.tsx")).toContain('name="project_id" value={selectedProject.id}');
    expect(read("src/components/forms/expense-form.tsx")).toContain('name="project_id" value={selectedProject.id}');
    expect(read("src/components/forms/invoice-form.tsx")).toContain('name="project_id" value={selectedProject.id}');
  });

  it("keeps duplicate route implementations aligned", () => {
    for (const path of [
      "(app)/projects/page.tsx",
      "(app)/projects/[projectId]/page.tsx",
      "(app)/time/page.tsx",
      "(app)/expenses/page.tsx",
      "(app)/billing/new/page.tsx",
    ]) {
      expect(read(`app/${path}`)).toBe(read(`src/app/${path}`));
    }
  });
});
