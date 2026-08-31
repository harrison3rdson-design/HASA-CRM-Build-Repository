import { chromium } from "playwright";
import { sha256Hex } from "@/lib/security/tokens";

export async function renderHtmlToPdf(html: string) {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const bytes = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
    });

    return {
      bytes: Buffer.from(bytes),
      sha256: sha256Hex(bytes),
      contentType: "application/pdf" as const,
    };
  } finally {
    await browser.close();
  }
}
