import { createAdminClient } from "@/lib/supabase-admin";

function esc(v: unknown) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c] as string));
}

export async function buildReceiptAppendixHtml(invoiceId: string) {
  const admin = createAdminClient();

  const { data: items, error: itemError } = await admin
    .from("invoice_items")
    .select("id")
    .eq("invoice_id", invoiceId);

  if (itemError) throw itemError;
  const itemIds = (items ?? []).map(x => x.id);
  if (!itemIds.length) return "";

  const { data: expenses, error: expenseError } = await admin
    .from("expenses")
    .select("id,expense_date,category,description,vendor,actual_cost,billable_amount,invoice_item_id")
    .in("invoice_item_id", itemIds);

  if (expenseError) throw expenseError;
  if (!expenses?.length) return "";

  const expenseIds = expenses.map(x => x.id);
  const { data: attachments, error: attachError } = await admin
    .from("expense_attachments")
    .select("*")
    .in("expense_id", expenseIds)
    .eq("attachment_type", "receipt");

  if (attachError) throw attachError;

  const bucket = process.env.RECEIPTS_BUCKET ?? "hasa-receipts";
  const byExpense = new Map<string, any[]>();

  for (const a of attachments ?? []) {
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(a.storage_path, 900);
    if (error) throw error;
    const list = byExpense.get(a.expense_id) ?? [];
    list.push({ ...a, signedUrl: data.signedUrl });
    byExpense.set(a.expense_id, list);
  }

  const sections = expenses.map((e: any) => {
    const receipts = byExpense.get(e.id) ?? [];
    const media = receipts.map((r: any) => {
      if (String(r.mime_type ?? "").startsWith("image/")) {
        return `<figure class="receipt-image">
          <img src="${esc(r.signedUrl)}" alt="Receipt ${esc(r.original_filename)}">
          <figcaption>${esc(r.original_filename)}</figcaption>
        </figure>`;
      }
      return `<div class="receipt-file"><strong>Receipt file:</strong> ${esc(r.original_filename)}
        <div>PDF/supporting file retained in project records.</div></div>`;
    }).join("");

    return `<section class="receipt-section">
      <h3>${esc(e.expense_date)} · ${esc(e.category)}${e.vendor ? ` · ${esc(e.vendor)}` : ""}</h3>
      <p>${esc(e.description ?? "")}</p>
      <p>Actual Cost: ${Number(e.actual_cost ?? 0).toFixed(2)} · Billable: ${Number(e.billable_amount ?? 0).toFixed(2)}</p>
      ${media || "<p>No receipt image attached.</p>"}
    </section>`;
  }).join("");

  return `<div class="page-break"></div>
    <section class="receipt-appendix">
      <h1>Receipt Appendix</h1>
      ${sections}
    </section>`;
}
