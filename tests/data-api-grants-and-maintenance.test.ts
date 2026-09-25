import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationsDirectory = path.join(root, "supabase", "migrations");
const compatibilityMigration = "20260925103600_explicit_data_api_grants.sql";

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function publicTablesCreated(sql: string) {
  return Array.from(
    sql.matchAll(/create\s+table(?:\s+if\s+not\s+exists)?\s+public\.([a-z0-9_]+)/gi),
    (match) => match[1],
  );
}

describe("explicit Data API grants and scheduled maintenance", () => {
  it("declares explicit least-privilege grants for every existing public table", () => {
    const migrationFiles = fs.readdirSync(migrationsDirectory)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const compatibility = read(`supabase/migrations/${compatibilityMigration}`);
    const existingTables = migrationFiles
      .filter((file) => file <= compatibilityMigration)
      .flatMap((file) => publicTablesCreated(read(`supabase/migrations/${file}`)));

    expect(existingTables.length).toBeGreaterThan(0);
    for (const table of existingTables) {
      expect(compatibility, `missing explicit grant declaration for public.${table}`)
        .toMatch(new RegExp(`\\bpublic\\.${table}\\b`, "i"));
    }

    expect(compatibility).toContain(
      "revoke all privileges on tables from anon, authenticated, service_role",
    );
    expect(compatibility).toContain(
      "revoke all privileges on sequences from anon, authenticated, service_role",
    );
    expect(compatibility).toContain("from anon, authenticated, service_role");
    expect(compatibility).not.toMatch(/\bgrant[\s\S]{0,500}\bto\s+anon\b/i);
  });

  it("requires future public tables to include RLS and explicit grants in their migration", () => {
    const futureMigrations = fs.readdirSync(migrationsDirectory)
      .filter((file) => file.endsWith(".sql") && file > compatibilityMigration)
      .sort();

    for (const file of futureMigrations) {
      const sql = read(`supabase/migrations/${file}`);
      for (const table of publicTablesCreated(sql)) {
        expect(sql, `${file} must enable RLS on public.${table}`).toMatch(
          new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i"),
        );
        expect(sql, `${file} must explicitly grant Data API access for public.${table}`).toMatch(
          new RegExp(`grant[\\s\\S]*?public\\.${table}[\\s\\S]*?to\\s+(?:authenticated|service_role)`, "i"),
        );
      }
    }
  });

  it("registers one protected daily maintenance invocation", () => {
    const config = JSON.parse(read("vercel.json"));
    expect(config.crons).toEqual([
      { path: "/api/internal/past-due", schedule: "0 12 * * *" },
    ]);

    const route = read("app/api/internal/past-due/route.ts");
    expect(route).toContain('request.headers.get("authorization") === `Bearer ${secret}`');
    expect(route).toContain("process.env.CRON_SECRET");
    expect(route).toContain("export async function GET");
    expect(route).toContain("markPastDueInvoices()");
    expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');

    const health = read("app/api/internal/health/production/route.ts");
    expect(health).toContain("cronSecret: !!process.env.CRON_SECRET");

    const packageJson = JSON.parse(read("package.json"));
    expect(packageJson.scripts.prebuild).toContain("scripts/verify-production-env.mjs");

    const preflight = read("scripts/verify-production-env.mjs");
    expect(preflight).toContain('process.env.VERCEL_ENV === "production"');
    expect(preflight).toContain('const required = ["CRON_SECRET"]');
    expect(preflight).toContain("!process.env[name]?.trim()");
  });
});
