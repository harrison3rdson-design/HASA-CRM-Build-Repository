import { createAdminClient } from "@/lib/supabase-admin";
import { renderHtmlToPdf } from "@/lib/documents/playwright-pdf";
import { buildReceiptAppendixHtml } from "@/lib/documents/receipt-appendix";
import { hasaHorizontalLogoDataUri } from "@/lib/branding/assets";
import { money } from "@/lib/ui/format";

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] as string);
}

async function loadInvoiceDocument(invoiceId: string, dueDate?: string) {
  const admin = createAdminClient();
  const [{ data: invoice, error }, { data: items, error: itemsError }, { data: company, error: companyError }] = await Promise.all([
    admin.from("invoices").select("*,client:clients(*),project:projects(*)").eq("id", invoiceId).single(),
    admin.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("sort_order"),
    admin.from("company_settings").select("*").limit(1).single(),
  ]);

  if (error) throw error;
  if (itemsError) throw itemsError;
  if (companyError) throw companyError;

  return {
    admin,
    invoice: dueDate ? { ...invoice, due_date: dueDate } : invoice,
    items: items ?? [],
    company,
  };
}

function invoiceDueDateLabel(invoice: any) {
  if (invoice.due_date) return invoice.due_date;
  return `Calculated when sent (${invoice.payment_terms})`;
}

export async function buildInvoiceHtml(invoiceId: string, options?: { dueDate?: string }) {
  const { admin, invoice, items, company } = await loadInvoiceDocument(invoiceId, options?.dueDate);
  const hasaLogoDataUri = hasaHorizontalLogoDataUri();
  const rows = items.map((item: any) => `<tr>
    <td>${esc(item.description)}</td>
    <td>${esc(item.quantity)}</td>
    <td>${money(item.rate)}</td>
    <td>${money(item.amount)}</td>
  </tr>`).join("");
  const appendix = invoice.include_receipt_appendix
    ? await buildReceiptAppendixHtml(invoiceId)
    : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:Letter;margin:.55in}
    body{font-family:Arial,sans-serif;color:#20252b;font-size:10.5pt;line-height:1.35}
    header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:2px solid #222;padding-bottom:12px}
    header img{display:block;max-width:280px;max-height:110px;object-fit:contain}
    .invoice-title{text-align:right}.invoice-title h1{font-size:25pt;margin:0}.muted{color:#68717c}
    table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:8px;border-bottom:1px solid #d9dde2;text-align:left}
    th:nth-child(n+2),td:nth-child(n+2){text-align:right}.totals{margin-left:auto;width:310px;margin-top:18px}
    .totals div{display:flex;justify-content:space-between;padding:5px 0}.balance{font-size:14pt;font-weight:bold;border-top:2px solid #222}
    footer{margin-top:28px;padding-top:12px;border-top:1px solid #d9dde2}
    .page-break{page-break-before:always}.receipt-section{page-break-inside:avoid;border-bottom:1px solid #ddd;padding:0 0 16px;margin:0 0 18px}
    .receipt-image img{max-width:100%;max-height:7in;object-fit:contain}.receipt-image figcaption{font-size:9pt;color:#666}
  </style></head><body>
    <header><img src="${hasaLogoDataUri}" alt="HASA Concepts">
      <div class="invoice-title"><h1>INVOICE</h1><strong>${esc(invoice.invoice_number)}</strong></div>
    </header>
    <p><strong>Bill To:</strong><br>${esc(invoice.client?.company_name)}</p>
    <p><strong>Project:</strong> ${esc(invoice.project?.project_number)} — ${esc(invoice.project?.project_name)}<br>
      <strong>Invoice Date:</strong> ${esc(invoice.invoice_date)}<br>
      <strong>Due Date:</strong> ${esc(invoiceDueDateLabel(invoice))}<br>
      <strong>Terms:</strong> ${esc(invoice.payment_terms)}</p>
    <table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals">
      <div><span>Subtotal</span><span>${money(invoice.subtotal)}</span></div>
      <div><span>Tax</span><span>${money(invoice.tax_amount)}</span></div>
      <div><span>Total</span><span>${money(invoice.total)}</span></div>
      <div><span>Paid</span><span>${money(invoice.amount_paid)}</span></div>
      <div class="balance"><span>Balance Due</span><span>${money(invoice.balance_due)}</span></div>
    </div>
    ${invoice.customer_notes ? `<p>${esc(invoice.customer_notes)}</p>` : ""}
    ${company.invoice_footer ? `<footer class="muted">${esc(company.invoice_footer)}</footer>` : ""}
    ${appendix}
  </body></html>`;

  return { admin, html, invoice };
}

export async function renderInvoicePdf(invoiceId: string, options?: { dueDate?: string }) {
  const { admin, html, invoice } = await buildInvoiceHtml(invoiceId, options);
  const pdf = await renderHtmlToPdf(html);
  return { admin, ...pdf, invoice };
}

export async function generateInvoicePdf(invoiceId: string, options?: { dueDate?: string }) {
  const { admin, bytes, sha256, invoice } = await renderInvoicePdf(invoiceId, options);
  const path = `clients/${invoice.client_id}/projects/${invoice.project_id}/invoices/${invoice.invoice_number}.pdf`;
  const { error: uploadError } = await admin.storage
    .from(process.env.DOCUMENTS_BUCKET ?? "hasa-documents")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw uploadError;

  return { path, sha256, invoice };
}
