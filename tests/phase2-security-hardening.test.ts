import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PublicRequestError,
  readPublicAcceptance,
  validatePublicToken,
} from "../src/lib/security/public-request";

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("phase 2 security hardening", () => {
  it("sets protective response headers for every application route", () => {
    const config = read("next.config.ts");
    expect(config).toContain("Content-Security-Policy");
    expect(config).toContain("Strict-Transport-Security");
    expect(config).toContain("X-Content-Type-Options");
    expect(config).toContain("X-Frame-Options");
    expect(config).toContain("Permissions-Policy");
    expect(config).toContain("frame-ancestors 'none'");
  });

  it("removes anonymous grants and unsafe authenticated table privileges", () => {
    const migration = read("supabase/migrations/20260903164700_phase2_least_privilege.sql");
    expect(migration).toContain("revoke all privileges on all tables in schema public from anon");
    expect(migration).toContain("revoke execute on all functions in schema public from public");
    expect(migration).toContain("revoke truncate, references, trigger on all tables in schema public from authenticated");
    expect(migration).toContain("alter default privileges for role postgres");
  });

  it("rejects malformed public document tokens", () => {
    expect(() => validatePublicToken("not-a-secure-token")).toThrow(PublicRequestError);
    expect(validatePublicToken("A".repeat(43))).toBe("A".repeat(43));
  });

  it("normalizes a valid, bounded acceptance request", async () => {
    const request = new Request("https://example.com/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        signerName: "  Jane Customer  ",
        signerTitle: "Owner",
        signerEmail: "jane@example.com",
        signerMobile: "+1 555 555 0100",
        signatureType: "untrusted-client-value",
        acceptanceStatement: "untrusted-client-value",
      }),
    });
    await expect(readPublicAcceptance(request)).resolves.toEqual({
      signerName: "Jane Customer",
      signerTitle: "Owner",
      signerEmail: "jane@example.com",
      signerMobile: "+1 555 555 0100",
      signatureType: "typed",
      acceptanceStatement: "I accept and authorize this document.",
    });
  });

  it("rejects oversized public request bodies", async () => {
    const request = new Request("https://example.com/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signerName: "A".repeat(9 * 1024) }),
    });
    await expect(readPublicAcceptance(request)).rejects.toMatchObject({ status: 413 });
  });
});
