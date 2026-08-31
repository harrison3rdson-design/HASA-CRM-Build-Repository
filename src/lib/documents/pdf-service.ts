import { sha256Hex } from "@/lib/security/tokens";

/**
 * Production contract for a PDF renderer.
 *
 * Use a server-side HTML-to-PDF engine (for example Playwright/Chromium)
 * or another PDF library selected by the deployment environment.
 * This scaffold deliberately keeps rendering provider-specific code isolated.
 */
export interface PdfResult {
  bytes: Buffer;
  sha256: string;
  contentType: "application/pdf";
}

export async function renderHtmlToPdf(html: string): Promise<PdfResult> {
  // Replace with the selected production renderer.
  // Do not mark an executed document complete until the PDF bytes exist
  // and their SHA-256 hash has been persisted.
  throw new Error(
    "PDF renderer not configured. Connect Playwright/Chromium or another server PDF engine."
  );
}

export function finalizePdf(bytes: Buffer): PdfResult {
  return {
    bytes,
    sha256: sha256Hex(bytes),
    contentType: "application/pdf",
  };
}
