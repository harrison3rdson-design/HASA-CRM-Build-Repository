import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return readFileSync(resolve(file), "utf8");
}

describe("backup and recovery package", () => {
  it("requires owner-administrator authorization and MFA before exporting", () => {
    const route = source("app/api/admin/recovery-backup/route.ts");
    expect(route).toContain("await Policies.userAdministration()");
    expect(route).toContain('origin !== new URL(request.url).origin');
    expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(route).toContain('"Content-Disposition"');
  });

  it("backs up application tables and private storage without secrets", () => {
    const backup = source("src/lib/recovery/create-backup.ts");
    expect(backup).toContain("RECOVERY_TABLES");
    expect(backup).toContain("admin.storage.listBuckets()");
    expect(backup).toContain("contentBase64");
    expect(backup).toContain("protectedDataSha256");
    expect(backup).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("shows the download only in the owner-only Settings section", () => {
    const settings = source("app/(app)/settings/page.tsx");
    expect(settings).toContain('Panel title="Backup & Recovery"');
    expect(settings).toContain('action="/api/admin/recovery-backup"');
    expect(settings.indexOf('Panel title="Backup & Recovery"')).toBeGreaterThan(
      settings.indexOf("{managedUsers ?"),
    );
  });
});
