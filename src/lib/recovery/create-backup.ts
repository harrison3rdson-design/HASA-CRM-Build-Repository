import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const RECOVERY_TABLES = [
  "activity_log",
  "additional_service_acceptances",
  "additional_service_expense_items",
  "additional_service_labor_items",
  "additional_service_sequences",
  "additional_service_share_links",
  "additional_services",
  "app_users",
  "billing_schedules",
  "clients",
  "company_settings",
  "contacts",
  "document_deliveries",
  "documents",
  "expense_attachments",
  "expenses",
  "generated_documents",
  "invoice_items",
  "invoice_number_sequences",
  "invoices",
  "payments",
  "project_phases",
  "projects",
  "proposal_acceptances",
  "proposal_expense_estimates",
  "proposal_fee_items",
  "proposal_material_items",
  "proposal_revisions",
  "proposal_sections",
  "proposal_share_links",
  "proposals",
  "receipt_inbox",
  "time_entries",
  "unit_service_entries",
] as const;

const PAGE_SIZE = 1_000;

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function exportTable(admin: SupabaseClient, table: string) {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const serialized = JSON.stringify(rows);
  return {
    schema: "public",
    table,
    rowCount: rows.length,
    sha256: sha256(serialized),
    rows,
  };
}

type StorageObjectBackup = {
  bucket: string;
  path: string;
  size: number;
  sha256: string;
  contentBase64: string;
};

async function exportStorageFolder(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
  objects: StorageObjectBackup[],
) {
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const page = data ?? [];

    for (const entry of page) {
      const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!entry.id) {
        await exportStorageFolder(admin, bucket, objectPath, objects);
        continue;
      }

      const { data: blob, error: downloadError } = await admin.storage
        .from(bucket)
        .download(objectPath);
      if (downloadError) throw downloadError;
      const bytes = Buffer.from(await blob.arrayBuffer());
      objects.push({
        bucket,
        path: objectPath,
        size: bytes.length,
        sha256: sha256(bytes),
        contentBase64: bytes.toString("base64"),
      });
    }

    if (page.length < PAGE_SIZE) break;
  }
}

export async function createApplicationRecoveryBackup(admin: SupabaseClient) {
  const [{ data: buckets, error: bucketError }, ...tables] = await Promise.all([
    admin.storage.listBuckets(),
    ...RECOVERY_TABLES.map((table) => exportTable(admin, table)),
  ]);
  if (bucketError) throw bucketError;

  const storageObjects: StorageObjectBackup[] = [];
  for (const bucket of buckets ?? []) {
    await exportStorageFolder(admin, bucket.id, "", storageObjects);
  }

  const protectedData = {
    tables,
    storage: {
      buckets: (buckets ?? []).map((bucket) => ({
        id: bucket.id,
        name: bucket.name,
        public: bucket.public,
        fileSizeLimit: bucket.file_size_limit,
        allowedMimeTypes: bucket.allowed_mime_types,
      })),
      objects: storageObjects,
    },
  };
  const protectedDataJson = JSON.stringify(protectedData);

  return {
    format: "HASA application recovery backup",
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    projectRef: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0],
    warnings: [
      "Contains confidential business records and private customer documents.",
      "Does not contain passwords, sessions, service keys, or MFA secrets.",
      "Restore into a non-production Supabase project and verify before cutover.",
    ],
    summary: {
      tableCount: tables.length,
      rowCount: tables.reduce((total, table) => total + table.rowCount, 0),
      bucketCount: buckets?.length ?? 0,
      objectCount: storageObjects.length,
      objectBytes: storageObjects.reduce((total, object) => total + object.size, 0),
    },
    integrity: {
      algorithm: "SHA-256",
      protectedDataSha256: sha256(protectedDataJson),
    },
    protectedData,
  };
}
