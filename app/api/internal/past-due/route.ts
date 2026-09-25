import { NextRequest, NextResponse } from "next/server";
import { markPastDueInvoices } from "@/lib/invoices/service";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  return request.headers.get("authorization") === `Bearer ${secret}`
    || request.headers.get("x-cron-secret") === secret;
}

async function runMaintenance(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  try {
    const updated = await markPastDueInvoices();
    const checkedAt = new Date().toISOString();
    console.info("[scheduled-maintenance] completed", { updated, checkedAt });

    return NextResponse.json(
      { ok: true, updated, checkedAt },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[scheduled-maintenance] failed", error);
    return NextResponse.json(
      { ok: false, error: "Scheduled maintenance failed." },
      { status: 500, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}

export async function GET(request: NextRequest) {
  return runMaintenance(request);
}

export async function POST(request: NextRequest) {
  return runMaintenance(request);
}
