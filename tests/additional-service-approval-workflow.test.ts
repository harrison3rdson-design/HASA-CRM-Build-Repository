import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("additional service approval workflow", () => {
  it("opens every authorization from its project and redirects new drafts into the work area", () => {
    const project = read("app/(app)/projects/[projectId]/page.tsx");
    const action = read("src/app/actions/additional-services.ts");

    expect(project).toContain("/additional-services/${a.id}");
    expect(action).toContain("redirect(`/additional-services/${data.id}`)");
  });

  it("provides draft editing, customer preview, send-and-lock, approval details, and executed PDF access", () => {
    const detail = read("app/(app)/additional-services/[authorizationId]/page.tsx");

    expect(detail).toContain("Authorization Work Area");
    expect(detail).toContain("AdditionalServiceEditForm");
    expect(detail).toContain("Preview Customer View");
    expect(detail).toContain("SendAdditionalServiceButton");
    expect(detail).toContain("Customer Approval");
    expect(detail).toContain("Open Executed PDF");
    expect(detail).toContain("Delivery History");
  });

  it("uses the same authorization document for preview and customer delivery", () => {
    const preview = read("app/additional-service-previews/[authorizationId]/page.tsx");
    const customer = read("app/public/additional-services/[token]/page.tsx");

    expect(preview).toContain("await getCurrentUser()");
    expect(preview).toContain("<AdditionalServiceDocument");
    expect(preview).toContain('buttonText="Accept Additional Service"');
    expect(customer).toContain("<AdditionalServiceDocument");
  });

  it("locks only after a successful delivery and revokes unusable links", () => {
    const send = read("src/app/actions/send-documents.ts");

    expect(send).toContain('result.status === "sent" || result.status === "delivered"');
    expect(send).toContain('update({ status: "sent", sent_at: new Date().toISOString(), locked: true })');
    expect(send).toContain('from("additional_service_share_links")');
    expect(send).toContain("The authorization remains editable and unlocked.");
  });

  it("keeps duplicate route implementations aligned", () => {
    for (const path of [
      "(app)/additional-services/[authorizationId]/page.tsx",
      "additional-service-previews/[authorizationId]/page.tsx",
      "public/additional-services/[token]/page.tsx",
    ]) {
      expect(read(`app/${path}`)).toBe(read(`src/app/${path}`));
    }
  });
});
