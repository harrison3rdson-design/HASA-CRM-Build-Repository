import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "HASA Concepts Management",
    release: "1",
    phase: "foundation",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
