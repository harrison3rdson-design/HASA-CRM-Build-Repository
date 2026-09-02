import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveChromiumPackUrl } from "../src/lib/documents/chromium-pack-url";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("serverless PDF renderer", () => {
  it("uses the immutable Vercel deployment URL for its Chromium package", () => {
    expect(resolveChromiumPackUrl({ VERCEL_URL: "example-deployment.vercel.app" })).toBe(
      "https://example-deployment.vercel.app/chromium-pack.tar"
    );
  });

  it("does not expose internal renderer errors to proposal customers", () => {
    for (const route of [
      "app/api/public/proposals/[token]/accept/route.ts",
      "src/app/api/public/proposals/[token]/accept/route.ts",
    ]) {
      const source = read(route);
      expect(source).not.toContain("e?.message ?? \"Acceptance failed.\"");
      expect(source).toContain("Please try again or contact HASA Concepts.");
    }
  });

  it("protects the live renderer health check with the owner policy", () => {
    for (const route of [
      "app/api/internal/health/pdf/route.ts",
      "src/app/api/internal/health/pdf/route.ts",
    ]) {
      const source = read(route);
      expect(source).toContain("await Policies.companySettings()");
      expect(source).toContain('"Cache-Control": "private, no-store"');
    }
  });

  it("provides an owner-only browser health page for production verification", () => {
    const route = read("app/(app)/internal/health/pdf/page.tsx");

    expect(route).toContain("await Policies.companySettings()");
    expect(route).toContain("renderHtmlToPdf");
    expect(route).toContain('export const dynamic = "force-dynamic"');
    expect(route).toContain("PDF renderer ready");
  });
});
