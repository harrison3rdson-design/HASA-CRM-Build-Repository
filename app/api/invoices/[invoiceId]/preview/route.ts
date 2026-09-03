import { Policies } from "@/lib/auth/action-policy";
import { renderInvoicePdf } from "@/lib/invoices/render";

export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  try {
    await Policies.internalRead();
  } catch {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  const { invoiceId } = await params;
  let pdf: Awaited<ReturnType<typeof renderInvoicePdf>>;
  try {
    pdf = await renderInvoicePdf(invoiceId);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "PGRST116") {
      return Response.json({ error: "Invoice not found." }, { status: 404 });
    }
    throw error;
  }
  const filename = `${pdf.invoice.invoice_number}-preview.pdf`.replace(/[^a-zA-Z0-9._-]/g, "-");

  return new Response(new Uint8Array(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
