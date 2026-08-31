import { NextRequest, NextResponse } from "next/server";
import { markPastDueInvoices } from "@/lib/invoices/service";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const updated = await markPastDueInvoices();
  return NextResponse.json({ updated });
}
