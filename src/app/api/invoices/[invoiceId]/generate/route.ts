import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await context.params;

  return NextResponse.json(
    {
      status: "scaffold",
      invoiceId,
      workflow: [
        "load invoice + client + project + branding",
        "load invoice line items",
        "optionally load expense detail",
        "optionally load receipt attachments",
        "render branded invoice HTML",
        "render PDF",
        "append expense/receipt pages when selected",
        "SHA-256 hash final bytes",
        "store PDF privately",
        "persist generated-document metadata",
        "attach PDF path/hash to invoice",
      ],
    },
    { status: 501 }
  );
}
