import { NextResponse } from "next/server";
import { Policies } from "@/lib/auth/action-policy";
import { renderHtmlToPdf } from "@/lib/documents/playwright-pdf";

export const maxDuration = 60;

export async function GET() {
  try {
    await Policies.companySettings();
    const startedAt = Date.now();
    const pdf = await renderHtmlToPdf(
      "<!doctype html><html><body><h1>HASA Concepts</h1><p>PDF renderer health check.</p></body></html>"
    );

    return NextResponse.json(
      {
        ready: pdf.bytes.length > 100,
        bytes: pdf.bytes.length,
        sha256: pdf.sha256,
        durationMs: Date.now() - startedAt,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("[pdf-health] failed", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { ready: false, error: "PDF renderer health check failed." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
