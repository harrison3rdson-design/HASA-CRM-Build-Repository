import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyRecoveryBackup } from "../scripts/verify-recovery-backup.mjs";

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

  it("verifies every table and private Storage payload before recovery", () => {
    const sha256 = (value: string | Buffer) =>
      createHash("sha256").update(value).digest("hex");
    const rows = [{ id: "client-1", name: "Recovery Test" }];
    const bytes = Buffer.from("private recovery file");
    const protectedData = {
      tables: [{
        schema: "public",
        table: "clients",
        rowCount: rows.length,
        sha256: sha256(JSON.stringify(rows)),
        rows,
      }],
      storage: {
        buckets: [{
          id: "hasa-documents",
          name: "hasa-documents",
          public: false,
          fileSizeLimit: null,
          allowedMimeTypes: null,
        }],
        objects: [{
          bucket: "hasa-documents",
          path: "recovery/client-1/document.pdf",
          size: bytes.length,
          sha256: sha256(bytes),
          contentBase64: bytes.toString("base64"),
        }],
      },
    };
    const backup = {
      format: "HASA application recovery backup",
      formatVersion: 1,
      createdAt: "2026-09-04T12:00:00.000Z",
      projectRef: "recovery-source",
      summary: {
        tableCount: 1,
        rowCount: 1,
        bucketCount: 1,
        objectCount: 1,
        objectBytes: bytes.length,
      },
      integrity: {
        algorithm: "SHA-256",
        protectedDataSha256: sha256(JSON.stringify(protectedData)),
      },
      protectedData,
    };

    expect(verifyRecoveryBackup(backup)).toMatchObject({
      valid: true,
      sourceProjectRef: "recovery-source",
      summary: backup.summary,
    });

    const corrupted = structuredClone(backup);
    corrupted.protectedData.storage.objects[0].contentBase64 =
      Buffer.from("altered").toString("base64");
    expect(() => verifyRecoveryBackup(corrupted))
      .toThrow("Protected-data checksum does not match");
  });

  it("rejects unsafe Storage paths even when the package checksum is recomputed", () => {
    const emptyHash = createHash("sha256").update(Buffer.alloc(0)).digest("hex");
    const protectedData = {
      tables: [],
      storage: {
        buckets: [{ id: "hasa-documents", name: "hasa-documents", public: false }],
        objects: [{
          bucket: "hasa-documents",
          path: "../outside.json",
          size: 0,
          sha256: emptyHash,
          contentBase64: "",
        }],
      },
    };
    const backup = {
      format: "HASA application recovery backup",
      formatVersion: 1,
      createdAt: "2026-09-04T12:00:00.000Z",
      projectRef: "recovery-source",
      summary: { tableCount: 0, rowCount: 0, bucketCount: 1, objectCount: 1, objectBytes: 0 },
      integrity: {
        algorithm: "SHA-256",
        protectedDataSha256: createHash("sha256")
          .update(JSON.stringify(protectedData))
          .digest("hex"),
      },
      protectedData,
    };

    expect(() => verifyRecoveryBackup(backup)).toThrow("path is unsafe");
  });
});
