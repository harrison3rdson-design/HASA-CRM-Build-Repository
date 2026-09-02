import { createAdminClient } from "@/lib/supabase-admin";
import { renderHtmlToPdf } from "@/lib/documents/playwright-pdf";
import { money } from "@/lib/ui/format";

function esc(v:any){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c] as string));}

export async function generateInvoicePdf(invoiceId: string, options?: { dueDate?: string }) {
  const admin = createAdminClient();

  const [{ data: invoice, error }, { data: items }, { data: company }] = await Promise.all([
    admin.from("invoices").select("*,client:clients(*),project:projects(*)").eq("id",invoiceId).single(),
    admin.from("invoice_items").select("*").eq("invoice_id",invoiceId).order("sort_order"),
    admin.from("company_settings").select("*").limit(1).single(),
  ]);
  if(error) throw error;

  const renderedInvoice = options?.dueDate
    ? { ...invoice, due_date: options.dueDate }
    : invoice;

  const rows=(items??[]).map((x:any)=>`<tr><td>${esc(x.description)}</td><td>${x.quantity}</td><td>${money(x.rate)}</td><td>${money(x.amount)}</td></tr>`).join("");

  const html=`<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;color:#222;font-size:10.5pt}header{display:flex;justify-content:space-between;border-bottom:2px solid #222;padding-bottom:14px}
  h1{font-size:24pt}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}th:nth-child(n+2),td:nth-child(n+2){text-align:right}
  .totals{margin-left:auto;width:300px;margin-top:18px}.totals div{display:flex;justify-content:space-between;padding:5px 0}.balance{font-size:14pt;font-weight:bold;border-top:2px solid #222}
  </style></head><body><header><div><strong>${esc(company.display_name)}</strong><br>${esc(company.email??"")}</div><div><h1>INVOICE</h1><strong>${esc(invoice.invoice_number)}</strong></div></header>
  <p><strong>Bill To:</strong><br>${esc(invoice.client?.company_name)}</p>
  <p><strong>Project:</strong> ${esc(invoice.project?.project_number)} — ${esc(invoice.project?.project_name)}<br>
  <strong>Invoice Date:</strong> ${esc(renderedInvoice.invoice_date)}<br><strong>Due Date:</strong> ${esc(renderedInvoice.due_date??"")}<br><strong>Terms:</strong> ${esc(renderedInvoice.payment_terms)}</p>
  <table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="totals"><div><span>Subtotal</span><span>${money(invoice.subtotal)}</span></div><div><span>Tax</span><span>${money(invoice.tax)}</span></div><div><span>Total</span><span>${money(invoice.total)}</span></div><div><span>Paid</span><span>${money(invoice.amount_paid)}</span></div><div class="balance"><span>Balance Due</span><span>${money(invoice.balance_due)}</span></div></div>
  <p>${esc(invoice.customer_notes??"")}</p></body></html>`;

  const pdf=await renderHtmlToPdf(html);
  const path=`clients/${invoice.client_id}/projects/${invoice.project_id}/invoices/${invoice.invoice_number}.pdf`;

  const {error:uploadError}=await admin.storage.from(process.env.DOCUMENTS_BUCKET??"hasa-documents")
    .upload(path,pdf.bytes,{contentType:"application/pdf",upsert:true});
  if(uploadError) throw uploadError;

  return {path,sha256:pdf.sha256,invoice:renderedInvoice};
}
