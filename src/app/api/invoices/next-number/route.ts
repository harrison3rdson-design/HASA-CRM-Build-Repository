import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { getNextInvoiceNumber } from "@/lib/invoices/service";

export async function POST(request: NextRequest) {
  await requireUser();
  const { projectId } = await request.json();

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const invoiceNumber = await getNextInvoiceNumber(projectId);
  return NextResponse.json({ invoiceNumber });
}
