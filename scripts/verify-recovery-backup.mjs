import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const EXPECTED_FORMAT = "HASA application recovery backup";
const EXPECTED_VERSION = 1;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(label + " must be an object.");
  }
  return value;
}

function array(value, label) {
  if (!Array.isArray(value)) throw new Error(label + " must be an array.");
  return value;
}

function count(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(label + " must be a non-negative integer.");
  }
  return value;
}

function checksum(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(label + " must be a lowercase SHA-256 value.");
  }
  return value;
}

function base64(value, label) {
  if (
    typeof value !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new Error(label + " is not valid Base64.");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new Error(label + " is not canonical Base64.");
  return bytes;
}

function storagePath(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1_024 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(label + " is unsafe.");
  }
  return value;
}

export function verifyRecoveryBackup(backup) {
  const root = object(backup, "Backup");
  if (root.format !== EXPECTED_FORMAT) throw new Error("Backup format is not recognized.");
  if (root.formatVersion !== EXPECTED_VERSION) {
    throw new Error("Backup format version " + String(root.formatVersion) + " is not supported.");
  }
  if (typeof root.createdAt !== "string" || Number.isNaN(Date.parse(root.createdAt))) {
    throw new Error("Backup creation time is invalid.");
  }
  if (typeof root.projectRef !== "string" || !/^[a-z0-9-]+$/.test(root.projectRef)) {
    throw new Error("Backup source project reference is invalid.");
  }

  const protectedData = object(root.protectedData, "Protected data");
  const tables = array(protectedData.tables, "Protected tables");
  const storage = object(protectedData.storage, "Protected storage");
  const buckets = array(storage.buckets, "Storage buckets");
  const objects = array(storage.objects, "Storage objects");
  const summary = object(root.summary, "Summary");
  const integrity = object(root.integrity, "Integrity");

  if (integrity.algorithm !== "SHA-256") throw new Error("Unsupported integrity algorithm.");
  const expectedHash = checksum(integrity.protectedDataSha256, "Protected-data checksum");
  const actualHash = sha256(JSON.stringify(protectedData));
  if (actualHash !== expectedHash) {
    throw new Error("Protected-data checksum does not match. The backup may be corrupted or altered.");
  }

  const tableNames = new Set();
  let rowCount = 0;
  for (const [index, rawTable] of tables.entries()) {
    const table = object(rawTable, "Table " + (index + 1));
    if (table.schema !== "public") throw new Error("Table " + (index + 1) + " is outside the public schema.");
    if (typeof table.table !== "string" || !/^[a-z][a-z0-9_]*$/.test(table.table)) {
      throw new Error("Table " + (index + 1) + " has an invalid name.");
    }
    if (tableNames.has(table.table)) throw new Error("Table " + table.table + " appears more than once.");
    tableNames.add(table.table);
    const rows = array(table.rows, "Rows for " + table.table);
    if (rows.length !== count(table.rowCount, "Row count for " + table.table)) {
      throw new Error("Row count for " + table.table + " does not match.");
    }
    if (sha256(JSON.stringify(rows)) !== checksum(table.sha256, "Checksum for " + table.table)) {
      throw new Error("Checksum for " + table.table + " does not match.");
    }
    rowCount += rows.length;
  }

  const bucketIds = new Set();
  for (const [index, rawBucket] of buckets.entries()) {
    const bucket = object(rawBucket, "Bucket " + (index + 1));
    if (typeof bucket.id !== "string" || bucket.id.length === 0 || bucket.id.length > 100) {
      throw new Error("Bucket " + (index + 1) + " has an invalid identifier.");
    }
    if (bucketIds.has(bucket.id)) throw new Error("Bucket " + bucket.id + " appears more than once.");
    bucketIds.add(bucket.id);
    if (bucket.public !== false) throw new Error("Bucket " + bucket.id + " is not private.");
  }

  const objectKeys = new Set();
  let objectBytes = 0;
  for (const [index, rawObject] of objects.entries()) {
    const item = object(rawObject, "Storage object " + (index + 1));
    if (typeof item.bucket !== "string" || !bucketIds.has(item.bucket)) {
      throw new Error("Storage object " + (index + 1) + " references an unknown bucket.");
    }
    const path = storagePath(item.path, "Storage object " + (index + 1) + " path");
    const key = item.bucket + "/" + path;
    if (objectKeys.has(key)) throw new Error("Storage object " + key + " appears more than once.");
    objectKeys.add(key);
    const bytes = base64(item.contentBase64, "Storage object " + key);
    if (bytes.length !== count(item.size, "Size for " + key)) {
      throw new Error("Size for " + key + " does not match.");
    }
    if (sha256(bytes) !== checksum(item.sha256, "Checksum for " + key)) {
      throw new Error("Checksum for " + key + " does not match.");
    }
    objectBytes += bytes.length;
  }

  const computedSummary = {
    tableCount: tables.length,
    rowCount,
    bucketCount: buckets.length,
    objectCount: objects.length,
    objectBytes,
  };
  for (const [key, value] of Object.entries(computedSummary)) {
    if (count(summary[key], "Summary " + key) !== value) {
      throw new Error("Summary " + key + " does not match.");
    }
  }

  return {
    valid: true,
    format: root.format,
    formatVersion: root.formatVersion,
    createdAt: root.createdAt,
    sourceProjectRef: root.projectRef,
    protectedDataSha256: actualHash,
    summary: computedSummary,
  };
}

export async function verifyRecoveryBackupFile(filePath) {
  const raw = await readFile(filePath, "utf8");
  try {
    return verifyRecoveryBackup(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("The recovery backup is not valid JSON.");
    throw error;
  }
}

async function main() {
  const argumentsWithoutSeparator = process.argv.slice(2).filter((value) => value !== "--");
  const filePath = argumentsWithoutSeparator[0];
  if (!filePath || argumentsWithoutSeparator.length !== 1) {
    throw new Error("Usage: pnpm recovery:verify -- <absolute-path-to-hasa-recovery.json>");
  }
  process.stdout.write(JSON.stringify(await verifyRecoveryBackupFile(filePath), null, 2) + "\n");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(
      "Recovery verification failed: " + (error instanceof Error ? error.message : "Unknown error") + "\n",
    );
    process.exitCode = 1;
  });
}
