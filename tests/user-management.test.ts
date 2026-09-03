import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("owner-managed application access", () => {
  it("shows user management only to owner administrators", () => {
    const page = source("src/app/(app)/settings/page.tsx");
    expect(page).toContain('appUser?.role === "owner_admin"');
    expect(page).toContain("<UserManagement");
  });

  it("guards every user-management mutation and keeps roles in app_users", () => {
    const actions = source("src/app/actions/user-administration.ts");
    expect(actions.match(/Policies\.userAdministration\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(actions).toContain('.from("app_users")');
    expect(actions).toContain('type: "invite"');
    expect(actions).not.toContain("app_metadata");
  });

  it("prevents self-lockout and removal of the final active owner", () => {
    const actions = source("src/app/actions/user-administration.ts");
    expect(actions).toContain("You cannot deactivate or remove your own Owner Administrator access.");
    expect(actions).toContain("At least one active Owner Administrator is required.");
    expect(actions).toContain('.eq("role", "owner_admin")');
    expect(actions).toContain('.eq("active", true)');
  });

  it("verifies invitation tokens on the server before setting a password", () => {
    const confirmRoute = source("src/app/auth/confirm/route.ts");
    const actions = source("src/app/actions/user-administration.ts");
    expect(confirmRoute).toContain("supabase.auth.verifyOtp");
    expect(actions).toContain("supabase.auth.updateUser({ password })");
    expect(actions).toContain("password.length < 12");
  });

  it("records invitation and access changes in the activity log", () => {
    const actions = source("src/app/actions/user-administration.ts");
    expect(actions).toContain('.from("activity_log")');
    expect(actions).toContain('eventType: "user.invited"');
    expect(actions).toContain('eventType: "user.access_updated"');
  });
});
