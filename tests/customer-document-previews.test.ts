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

  it("clearly separates proposal details from the customer summary", () => {
    const proposalDocument = source("src/components/public/proposal-document.tsx");
    const publicCss = source("src/styles/public.css");
    const executedProposal = source("src/lib/documents/executed-html.ts");

    expect(proposalDocument).toContain('className="proposal-details-area"');
    expect(proposalDocument).toContain('className="proposal-summary-area"');
    expect(proposalDocument).toContain("Scope and Pricing Details");
    expect(proposalDocument).toContain("Investment and Commercial Terms");
    expect(publicCss).toContain(".proposal-details-area");
    expect(publicCss).toContain(".proposal-summary-area");
    expect(executedProposal).toContain('class="proposal-details-area"');
    expect(executedProposal).toContain('class="proposal-summary-area"');
  });

  it("omits a zero-value materials summary when no materials exist", () => {
    const proposalDocument = source("src/components/public/proposal-document.tsx");
    const executedProposal = source("src/lib/documents/executed-html.ts");

    expect(proposalDocument).toContain("const showMaterialsSummary = materials.length > 0");
    expect(proposalDocument).toContain("{showMaterialsSummary ? (");
    expect(executedProposal).toContain("const showMaterialsSummary = (data.materials ?? []).length > 0");
    expect(executedProposal).toContain("${showMaterialsSummary ?");
  });

  it("packages filesystem branding assets with every serverless PDF route", () => {
    const config = source("next.config.ts");
    const invoiceRenderer = source("src/lib/invoices/render.ts");

    expect(config).toContain("outputFileTracingIncludes");
    expect(config).toContain('"./public/branding/**/*"');
    expect(invoiceRenderer).not.toContain("const HASA_LOGO_DATA_URI = hasaHorizontalLogoDataUri()");
  });

  it("previews the same invoice PDF renderer used for customer delivery without uploading or changing status", () => {
    const previewRoute = source("app/api/invoices/[invoiceId]/preview/route.ts");
    const sourcePreviewRoute = source("src/app/api/invoices/[invoiceId]/preview/route.ts");
    const invoiceRenderer = source("src/lib/invoices/render.ts");
    const invoicePage = source("app/(app)/billing/[invoiceId]/page.tsx");

    expect(previewRoute).toContain("Policies.internalRead");
    expect(previewRoute).toContain("renderInvoicePdf(invoiceId)");
    expect(previewRoute).toContain('status: 401');
    expect(previewRoute).toContain('status: 404');
    expect(previewRoute).toContain('"Content-Disposition": `inline; filename="${filename}"`');
    expect(previewRoute).not.toContain("generateInvoicePdf");
    expect(previewRoute).not.toContain(".upload(");
    expect(previewRoute).toBe(sourcePreviewRoute);
    expect(invoiceRenderer).toContain("await renderInvoicePdf(invoiceId, options)");
    expect(invoicePage).toContain("Preview Customer PDF");
    expect(invoicePage).toContain("/api/invoices/${invoiceId}/preview");
  });
});
