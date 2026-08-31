import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await context.params;
  const body = await request.json();

  return NextResponse.json(
    {
      status: "scaffold",
      invoiceId,
      delivery: body?.delivery ?? "email",
      message:
        "Require an issued invoice with generated PDF, create secure retrieval link if used, send through SMS/email adapter, and record document_deliveries.",
    },
    { status: 501 }
  );
}
