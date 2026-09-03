import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("customer document previews and branding", () => {
  it("shows the bundled HASA logo in proposal and additional-service customer views", () => {
    expect(source("src/components/public/proposal-document.tsx"))
      .toContain("/branding/hasa-logo-horizontal.jpeg");
    expect(source("src/components/additional-services/additional-service-document.tsx"))
      .toContain("/branding/hasa-logo-horizontal.jpeg");
  });

  it("embeds the HASA logo in executed and invoice PDFs", () => {
    expect(source("src/lib/documents/executed-html.ts"))
      .toContain("hasaHorizontalLogoDataUri");
    expect(source("src/lib/invoices/render.ts"))
      .toContain("hasaHorizontalLogoDataUri");
  });

  it("previews the same invoice PDF renderer used for customer delivery without uploading or changing status", () => {
    const previewRoute = source("app/api/invoices/[invoiceId]/preview/route.ts");
    const sourcePreviewRoute = source("src/app/api/invoices/[invoiceId]/preview/route.ts");
    const invoiceRenderer = source("src/lib/invoices/render.ts");
    const invoicePage = source("app/(app)/billing/[invoiceId]/page.tsx");

    expect(previewRoute).toContain("requireUser");
    expect(previewRoute).toContain("renderInvoicePdf(invoiceId)");
    expect(previewRoute).toContain('"Content-Disposition": `inline; filename="${filename}"`');
    expect(previewRoute).not.toContain("generateInvoicePdf");
    expect(previewRoute).not.toContain(".upload(");
    expect(previewRoute).toBe(sourcePreviewRoute);
    expect(invoiceRenderer).toContain("await renderInvoicePdf(invoiceId, options)");
    expect(invoicePage).toContain("Preview Customer PDF");
    expect(invoicePage).toContain("/api/invoices/${invoiceId}/preview");
  });
});
