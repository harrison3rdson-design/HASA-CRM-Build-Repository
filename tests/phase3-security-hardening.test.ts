import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PublicRequestError, rejectCrossSiteSubmission } from "../src/lib/security/public-request";
import { requiredUuid, safeOriginalFilename, validateUploadedFile } from "../src/lib/security/uploads";

const source = (path: string) => readFileSync(path, "utf8");

describe("phase 3 security hardening", () => {
  it("requires active application access for internal customer previews", () => {
    for (const path of [
      "app/proposal-previews/[proposalId]/page.tsx",
      "app/additional-service-previews/[authorizationId]/page.tsx",
      "src/app/proposal-previews/[proposalId]/page.tsx",
      "src/app/additional-service-previews/[authorizationId]/page.tsx",
    ]) {
      expect(source(path), path).toContain("getCurrentAppUser");
      expect(source(path), path).toContain("!appUser?.active");
    }
  });

  it("keeps the service-role client server-only", () => {
    expect(source("src/lib/supabase-admin.ts")).toContain('import "server-only"');
  });

  it("hides framework details and prevents customer-document indexing", () => {
    const config = source("next.config.ts");
    expect(config).toContain("poweredByHeader: false");
    expect(config).toContain("X-Permitted-Cross-Domain-Policies");
    expect(config).toContain("X-Robots-Tag");
    expect(config).toContain('source: "/public/:path*"');
  });

  it("validates upload identifiers and filenames", () => {
    expect(requiredUuid("45327e16-94a7-4653-9440-f9ddcbc230bb", "Project"))
      .toBe("45327e16-94a7-4653-9440-f9ddcbc230bb");
    expect(() => requiredUuid("../../other-project", "Project")).toThrow("Project is invalid.");
    expect(safeOriginalFilename("../../unsafe<script>.pdf")).not.toMatch(/[<>/\\]/);
  });

  it("allows signed PDFs and rejects spoofed files", async () => {
    const pdf = new File([
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]),
    ], "evidence.pdf", { type: "application/pdf" });
    await expect(validateUploadedFile(pdf, "Document", 1024)).resolves.toBeUndefined();

    const spoofed = new File(["not a pdf"], "evidence.pdf", { type: "application/pdf" });
    await expect(validateUploadedFile(spoofed, "Document", 1024)).rejects.toThrow("do not match");
  });

  it("rejects cross-site public approval submissions", () => {
    const request = new Request(
      "https://hasa-concepts-management.vercel.app/api/public/proposals/token/accept",
      {
        method: "POST",
        headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
      },
    );
    expect(() => rejectCrossSiteSubmission(request)).toThrow(PublicRequestError);
  });

  it("checks upload record relationships and cleans up orphaned blobs", () => {
    const documents = source("src/app/actions/documents.ts");
    const expenses = source("src/app/actions/expenses.ts");
    expect(documents).toContain('.eq("client_id", clientId)');
    expect(documents).toContain("uploaded_by: appUser.id");
    expect(documents).toContain(".remove([path])");
    expect(expenses).toContain('.eq("project_id", projectId)');
    expect(expenses).toContain(".remove([path])");
  });
});
