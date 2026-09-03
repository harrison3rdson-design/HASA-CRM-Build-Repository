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
    const server = read("src/lib/auth/server.ts");

    expect(action).toContain('redirect(isMfaVerified(mfaStatus) ? "/dashboard" : "/mfa")');
    expect(action).toContain("const admin = createAdminClient()");
    expect(action).toContain("await admin");
    expect(layout).toContain("getMfaStatus(supabase)");
    expect(layout).toContain('redirect("/mfa")');
    expect(server).toContain('redirect("/mfa")');
  });

  it("supports TOTP enrollment, challenge, and verification with the SSR cookie session", () => {
    const form = read("src/components/forms/mfa-form.tsx");
    const browserClient = read("src/lib/supabase.ts");

    expect(form).toContain("supabase.auth.mfa.enroll");
    expect(form).toContain('factorType: "totp"');
    expect(form).toContain("supabase.auth.mfa.challenge");
    expect(form).toContain("supabase.auth.mfa.verify");
    expect(browserClient).toContain("createBrowserClient");
    expect(browserClient).toContain('from "@supabase/ssr"');
  });

  it("requires an AAL2 JWT before database roles unlock business records", () => {
    const migration = read(
      "supabase/migrations/20260903212750_enforce_mfa_aal2.sql",
    );

    expect(migration).toContain("auth.jwt()->>'aal'");
    expect(migration).toContain("= 'aal2'");
    expect(migration).toContain("create or replace function private.current_user_role()");
  });
});
