import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("MFA device management", () => {
  it("is available from the Settings account-security area", () => {
    const settings = read("app/(app)/settings/page.tsx");

    expect(settings).toContain('Panel title="Account Security"');
    expect(settings).toContain("<MfaManagement");
  });

  it("supports listing, enrolling, verifying, and removing TOTP factors", () => {
    const management = read("src/components/settings/mfa-management.tsx");

    expect(management).toContain("supabase.auth.mfa.listFactors");
    expect(management).toContain("supabase.auth.mfa.enroll");
    expect(management).toContain("supabase.auth.mfa.challenge");
    expect(management).toContain("supabase.auth.mfa.verify");
    expect(management).toContain("supabase.auth.mfa.unenroll");
  });

  it("protects the final factor and verifies a different factor before removal", () => {
    const management = read("src/components/settings/mfa-management.tsx");

    expect(management).toContain("verifiedFactors.length <= 1");
    expect(management).toContain("factor.id !== removalTargetId");
    expect(management).toContain("verificationFactorId === removalTargetId");
    expect(management).toContain("Verify Backup and Remove");
  });
});
