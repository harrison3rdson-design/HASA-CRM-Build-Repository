import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("mandatory multi-factor authentication", () => {
  it("routes password-authenticated users through MFA before the dashboard", () => {
    const action = read("src/app/actions/auth.ts");
    const layout = read("app/(app)/layout.tsx");

    expect(action).toContain('redirect(isMfaVerified(mfaStatus) ? "/dashboard" : "/mfa")');
    expect(layout).toContain("getMfaStatus(supabase)");
    expect(layout).toContain('redirect("/mfa")');
  });

  it("supports TOTP enrollment, challenge, and verification", () => {
    const form = read("src/components/forms/mfa-form.tsx");

    expect(form).toContain("supabase.auth.mfa.enroll");
    expect(form).toContain('factorType: "totp"');
    expect(form).toContain("supabase.auth.mfa.challenge");
    expect(form).toContain("supabase.auth.mfa.verify");
  });

  it("requires an AAL2 JWT before database roles unlock business records", () => {
    const migration = read(
      "supabase/migrations/20260903202635_enforce_mfa_aal2.sql",
    );

    expect(migration).toContain("auth.jwt()->>'aal'");
    expect(migration).toContain("= 'aal2'");
    expect(migration).toContain("create or replace function private.current_user_role()");
  });
});
