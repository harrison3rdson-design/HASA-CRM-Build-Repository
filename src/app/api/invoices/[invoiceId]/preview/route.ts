import { requireUser } from "@/lib/auth/server";
import { renderInvoicePdf } from "@/lib/invoices/render";

export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  await requireUser();
  const { invoiceId } = await params;
  const pdf = await renderInvoicePdf(invoiceId);
  const filename = `${pdf.invoice.invoice_number}-preview.pdf`.replace(/[^a-zA-Z0-9._-]/g, "-");

  return new Response(new Uint8Array(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
