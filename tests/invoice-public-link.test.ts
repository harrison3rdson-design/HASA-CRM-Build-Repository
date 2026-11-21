import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  INVOICE_LINK_VALIDITY_DAYS,
  INVOICE_LINK_VALIDITY_SECONDS,
  INVOICE_STORAGE_URL_VALIDITY_SECONDS,
  invoiceLinkExpiresAt,
} from "../src/lib/public/invoice-link-policy";

const read = (path: string) => readFileSync(path, "utf8");

describe("public invoice links", () => {
  it("uses exactly 120 days for the customer token", () => {
    const now = Date.UTC(2026, 10, 21, 12, 0, 0);
    expect(INVOICE_LINK_VALIDITY_DAYS).toBe(120);
    expect(INVOICE_LINK_VALIDITY_SECONDS).toBe(10_368_000);
    expect(new Date(invoiceLinkExpiresAt(now)).getTime() - now)
      .toBe(10_368_000 * 1000);
  });

  it("creates only a ten-minute Supabase Storage URL after token validation", () => {
    const route = read("app/public/invoices/[token]/page.tsx");
    expect(INVOICE_STORAGE_URL_VALIDITY_SECONDS).toBe(600);
    expect(route.indexOf("resolveInvoiceShareLink(token)"))
      .toBeLessThan(route.indexOf("createSignedDocumentUrl("));
    expect(route).toContain("INVOICE_STORAGE_URL_VALIDITY_SECONDS");
  });

  it("sends a stable CRM URL instead of a Storage signed URL", () => {
    const action = read("src/app/actions/invoice-delivery.ts");
    expect(action).toContain("/public/invoices/${link.token}");
    expect(action).toContain("createInvoiceShareLink");
    expect(action).not.toContain("createSignedDocumentUrl");
  });

  it("stores only token hashes and keeps the table server-only", () => {
    const migration = read("supabase/migrations/20261121134031_invoice_share_links.sql");
    const publicInvoice = read("src/lib/public/invoice.ts");
    expect(migration).toContain("token_hash text not null unique");
    expect(migration).not.toContain(" token text");
    expect(migration).toContain("from public, anon, authenticated, service_role");
    expect(migration).toContain("to service_role");
    expect(publicInvoice).toContain("hashPublicToken(token)");
  });

  it("renders friendly branded states for expired and invalid tokens", () => {
    const route = read("app/public/invoices/[token]/page.tsx");
    expect(route).toContain("This invoice link has expired");
    expect(route).toContain("This invoice link is not valid");
    expect(route).toContain("HASA Concepts");
    expect(read("app/public/invoices/[token]/page.tsx"))
      .toBe(read("src/app/public/invoices/[token]/page.tsx"));
  });
});
