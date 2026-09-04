import type { InvoiceDocumentModel, ProposalDocumentModel } from "@/types/documents";
import { proposalRevisionLabel } from "@/lib/proposal-revisions";

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function header(branding: ProposalDocumentModel["branding"]): string {
  const logo = branding.logoHorizontalUrl
    ? `<img src="${esc(branding.logoHorizontalUrl)}" alt="${esc(branding.displayName)}" class="logo" />`
    : `<div class="wordmark">HASA <span>CONCEPTS</span></div>`;

  return `
    <header>
      ${logo}
      <div class="company-meta">
        <strong>${esc(branding.legalName)}</strong>
        ${(branding.addressLines ?? []).map(esc).join("<br>")}
        ${branding.phone ? `<br>${esc(branding.phone)}` : ""}
        ${branding.email ? `<br>${esc(branding.email)}` : ""}
      </div>
    </header>`;
}

function shell(title: string, body: string, branding: ProposalDocumentModel["branding"]): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: Letter; margin: 0.55in; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; font-size: 10.5pt; line-height: 1.45; }
  header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:16px; border-bottom:2px solid #333; }
  .logo { max-height:52px; max-width:260px; object-fit:contain; }
  .wordmark { font-size:24px; font-weight:800; letter-spacing:.03em; }
  .wordmark span { font-weight:500; }
  .company-meta { text-align:right; font-size:8.5pt; color:#4b5563; }
  h1 { font-size:18pt; margin:20px 0 6px; }
  h2 { font-size:12pt; margin:18px 0 6px; }
  .muted { color:#6b7280; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  table { width:100%; border-collapse:collapse; margin-top:10px; }
  th,td { padding:7px 6px; border-bottom:1px solid #d1d5db; vertical-align:top; }
  th { text-align:left; font-size:9pt; text-transform:uppercase; letter-spacing:.04em; color:#6b7280; }
  .right { text-align:right; }
  .totals { margin-left:auto; width:300px; }
  footer { margin-top:28px; border-top:1px solid #d1d5db; padding-top:8px; font-size:8.5pt; color:#6b7280; }
</style>
</head>
<body>
${header(branding)}
${body}
</body>
</html>`;
}

export function renderProposalHtml(model: ProposalDocumentModel): string {
  const proposalTermsSection = model.proposalTerms
    ? '<section style="page-break-before:always"><h1>Proposal Terms and Conditions</h1><div>'
      + esc(model.proposalTerms).replaceAll("\n", "<br>")
      + "</div></section>"
    : "";
  const body = `
    <h1>Statement of Work</h1>
    <div class="grid">
      <div>
        <strong>Proposal #${esc(model.proposalNumber)}</strong><br>
        ${esc(proposalRevisionLabel(model.revisionNumber))}<br>
        <span class="muted">${esc(model.proposalDate)}</span>
      </div>
      <div>
        <strong>${esc(model.clientCompany)}</strong><br>
        ${model.clientContact ? `${esc(model.clientContact)}<br>` : ""}
        ${esc(model.projectName)}
        ${model.projectLocation ? `<br>${esc(model.projectLocation)}` : ""}
      </div>
    </div>

    ${model.sections.map(s => `
      <h2>${esc(s.heading)}</h2>
      <div>${esc(s.content).replaceAll("\n","<br>")}</div>
    `).join("")}

    <h2>Professional Fees</h2>
    <table>
      <thead><tr><th>Description</th><th class="right">Amount</th></tr></thead>
      <tbody>
      ${model.feeItems.map(i => `<tr><td>${esc(i.description)}</td><td class="right">${money(i.amount)}</td></tr>`).join("")}
      </tbody>
    </table>

    <h2>Estimated Expenses</h2>
    <table>
      <thead><tr><th>Category</th><th>Description</th><th class="right">Estimate</th></tr></thead>
      <tbody>
      ${model.expenseEstimates.map(i => `<tr><td>${esc(i.category)}</td><td>${esc(i.description)}</td><td class="right">${money(i.estimatedAmount)}</td></tr>`).join("")}
      </tbody>
    </table>

    <table class="totals">
      <tr><td>Professional Fee</td><td class="right">${money(model.professionalFee)}</td></tr>
      <tr><td>Estimated Expenses</td><td class="right">${money(model.estimatedExpenses)}</td></tr>
      <tr><td><strong>Estimated Total</strong></td><td class="right"><strong>${money(model.estimatedTotal)}</strong></td></tr>
    </table>

    <p><strong>Payment Terms:</strong> ${esc(model.paymentTerms)}<br>
    <strong>Proposal Validity:</strong> ${model.validityDays} days</p>

    <footer>${esc(model.branding.proposalFooter ?? model.branding.legalName)}</footer>
    ${proposalTermsSection}`;

  return shell(`Proposal ${model.proposalNumber}`, body, model.branding);
}

export function renderInvoiceHtml(model: InvoiceDocumentModel): string {
  const body = `
    <h1>Invoice</h1>
    <div class="grid">
      <div>
        <strong>${esc(model.clientCompany)}</strong><br>
        ${model.clientContact ? esc(model.clientContact) : ""}
      </div>
      <div>
        <strong>${esc(model.invoiceNumber)}</strong><br>
        Invoice date: ${esc(model.invoiceDate)}<br>
        ${model.dueDate ? `Due date: ${esc(model.dueDate)}<br>` : ""}
        Terms: ${esc(model.terms)}
      </div>
    </div>

    <p><strong>Project ${esc(model.projectNumber)}:</strong> ${esc(model.projectName)}</p>

    <table>
      <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
      <tbody>
      ${model.items.map(i => `
        <tr>
          <td>${esc(i.description)}</td>
          <td class="right">${i.quantity}</td>
          <td class="right">${money(i.rate)}</td>
          <td class="right">${money(i.amount)}</td>
        </tr>`).join("")}
      </tbody>
    </table>

    <table class="totals">
      <tr><td>Subtotal</td><td class="right">${money(model.subtotal)}</td></tr>
      <tr><td>Tax</td><td class="right">${money(model.taxAmount)}</td></tr>
      <tr><td>Payments</td><td class="right">${money(model.amountPaid)}</td></tr>
      <tr><td><strong>Balance Due</strong></td><td class="right"><strong>${money(model.balanceDue)}</strong></td></tr>
    </table>

    ${model.includeExpenseDetail ? `<p><strong>Expense detail:</strong> included in generated invoice package.</p>` : ""}
    ${model.includeReceiptAppendix ? `<p><strong>Receipt appendix:</strong> included in generated invoice package.</p>` : ""}

    <footer>${esc(model.branding.invoiceFooter ?? model.branding.legalName)}</footer>`;

  return shell(`Invoice ${model.invoiceNumber}`, body, model.branding);
}
