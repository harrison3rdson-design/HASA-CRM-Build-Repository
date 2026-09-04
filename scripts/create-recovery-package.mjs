import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const PUBLIC_TABLES = [
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
];

const PAGE_SIZE = 1_000;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error("Arguments must be provided as --name value pairs.");
    }
    args[key.slice(2)] = value;
  }
  return args;
}

function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[name] = value.replace(/\\n/g, "\n");
  }
  return values;
}

function safeSegment(value) {
  if (!value || value === "." || value === ".." || /[\\/]/.test(value)) {
    throw new Error(`Unsafe path segment received: ${value}`);
  }
  return value;
}

function encodedObjectPath(objectPath) {
  return objectPath.split("/").map(encodeURIComponent).join("/");
}

async function requestJson(url, init, label) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${label} failed (${response.status}): ${body.slice(0, 300)}`);
  }
  return response.json();
}

async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function listFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, entryPath)));
    if (entry.isFile()) files.push(path.relative(root, entryPath).replaceAll("\\", "/"));
  }
  return files;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envFile = path.resolve(args.env ?? "");
  const outputRoot = path.resolve(args.output ?? "");
  const migrationsSource = path.resolve(args.migrations ?? "");
  if (!args.env || !args.output || !args.migrations) {
    throw new Error("Required arguments: --env, --output, and --migrations.");
  }

  const env = parseEnv(await readFile(envFile, "utf8"));
  const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceKey) {
    throw new Error("The environment export is missing Supabase URL or service-role credentials.");
  }

  await mkdir(path.join(outputRoot, "data", "public"), { recursive: true });
  await mkdir(path.join(outputRoot, "storage"), { recursive: true });
  await cp(migrationsSource, path.join(outputRoot, "schema", "migrations"), {
    recursive: true,
  });

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };
  const tableInventory = [];

  for (const table of PUBLIC_TABLES) {
    const rows = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await requestJson(
        `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?select=*`,
        {
          headers: {
            ...headers,
            Range: `${offset}-${offset + PAGE_SIZE - 1}`,
          },
        },
        `Exporting public.${table}`,
      );
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    const destination = path.join(outputRoot, "data", "public", `${safeSegment(table)}.json`);
    await writeFile(destination, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
    tableInventory.push({ table: `public.${table}`, rows: rows.length });
  }

  const buckets = await requestJson(
    `${supabaseUrl}/storage/v1/bucket`,
    { headers },
    "Listing storage buckets",
  );
  const storageInventory = [];

  async function exportFolder(bucket, prefix = "") {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const entries = await requestJson(
        `${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket.id)}`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            prefix,
            limit: PAGE_SIZE,
            offset,
            sortBy: { column: "name", order: "asc" },
          }),
        },
        `Listing storage bucket ${bucket.id}`,
      );

      for (const entry of entries) {
        safeSegment(entry.name);
        const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (!entry.id) {
          await exportFolder(bucket, objectPath);
          continue;
        }

        const response = await fetch(
          `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket.id)}/${encodedObjectPath(objectPath)}`,
          { headers },
        );
        if (!response.ok) {
          throw new Error(`Downloading ${bucket.id}/${objectPath} failed (${response.status}).`);
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        const destination = path.join(
          outputRoot,
          "storage",
          safeSegment(bucket.id),
          ...objectPath.split("/").map(safeSegment),
        );
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, bytes);
        storageInventory.push({
          bucket: bucket.id,
          object: objectPath,
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      }

      if (entries.length < PAGE_SIZE) break;
    }
  }

  for (const bucket of buckets) {
    await exportFolder(bucket);
  }

  const manifest = {
    format: "HASA application recovery package",
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    projectRef: args["project-ref"] ?? "unknown",
    sourceCommit: args.commit ?? "unknown",
    database: {
      schemaSource: "schema/migrations",
      publicTables: tableInventory,
      totalRows: tableInventory.reduce((total, item) => total + item.rows, 0),
      exclusions: [
        "Managed Supabase auth secrets and password hashes",
        "Supabase platform configuration",
        "Vercel environment variable values",
      ],
    },
    storage: {
      buckets: buckets.map((bucket) => ({
        id: bucket.id,
        name: bucket.name,
        public: bucket.public,
        fileSizeLimit: bucket.file_size_limit,
        allowedMimeTypes: bucket.allowed_mime_types,
      })),
      objects: storageInventory,
      totalObjects: storageInventory.length,
      totalBytes: storageInventory.reduce((total, item) => total + item.bytes, 0),
    },
  };
  await writeFile(
    path.join(outputRoot, "snapshot-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  const files = (await listFiles(outputRoot))
    .filter((file) => file !== "checksums.sha256")
    .sort();
  const checksumLines = [];
  for (const file of files) {
    checksumLines.push(`${await sha256(path.join(outputRoot, file))}  ${file}`);
  }
  await writeFile(path.join(outputRoot, "checksums.sha256"), `${checksumLines.join("\n")}\n`);

  const verification = {
    verifiedAt: new Date().toISOString(),
    status: "PASS",
    checksummedFiles: checksumLines.length,
    exportedTables: tableInventory.length,
    exportedRows: manifest.database.totalRows,
    exportedStorageObjects: manifest.storage.totalObjects,
    exportedStorageBytes: manifest.storage.totalBytes,
  };
  await writeFile(
    path.join(outputRoot, "verification.json"),
    `${JSON.stringify(verification, null, 2)}\n`,
    "utf8",
  );

  console.log(JSON.stringify(verification));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
