import { money } from "@/lib/ui/format";
import { proposalRevisionLabel } from "@/lib/proposal-revisions";
import { hasaHorizontalLogoDataUri } from "@/lib/branding/assets";

export function executedProposalHtml(data: any, signer: any) {
  const hasaLogoDataUri = hasaHorizontalLogoDataUri();
  const showMaterialsSummary = (data.materials ?? []).length > 0
    || Number(data.revision.estimated_materials ?? 0) !== 0;
  const proposalTerms = escapeHtml(data.revision.proposal_terms ?? "").replace(/\n/g, "<br>");
  const proposalTermsSection = proposalTerms
    ? '<section class="proposal-terms"><h1>Proposal Terms and Conditions</h1><p>Incorporated into Proposal #'
      + escapeHtml(data.proposal.proposal_number)
      + " · "
      + escapeHtml(proposalRevisionLabel(data.revision.revision_number))
      + "</p><p>"
      + proposalTerms
      + "</p></section>"
    : "";
  const sections = (data.sections ?? []).map((s:any) =>
    `<section><h2>${escapeHtml(s.heading ?? s.section_type)}</h2><p>${escapeHtml(s.content ?? "").replace(/\n/g,"<br>")}</p></section>`
  ).join("");

  const fees = (data.fees ?? []).map((f:any) =>
    `<tr><td>${escapeHtml(f.description)}</td><td>${escapeHtml(serviceBillingLabel(f.billing_type))}</td><td>${escapeHtml(f.quantity)} ${escapeHtml(f.unit ?? "")}</td><td>${f.billing_type === "included" ? "Included" : money(f.rate)}</td><td>${f.billing_type === "included" ? "Included" : money(f.amount)}</td></tr>`
  ).join("");

  const expenses = (data.expenses ?? []).map((e:any) =>
    `<tr><td>${escapeHtml(e.category)}</td><td>${escapeHtml(e.description ?? "")}</td><td>${escapeHtml(e.estimated_quantity)} ${escapeHtml(e.unit ?? "")}</td><td>${money(e.estimated_rate)}</td><td>${money(e.estimated_amount)}</td></tr>`
  ).join("");

  const materials = (data.materials ?? []).map((material:any) =>
    `<tr><td>${escapeHtml(material.description)}</td><td>${escapeHtml(material.quantity)} ${escapeHtml(material.unit)}</td><td>${money(material.unit_price)}</td><td>${money(material.amount)}</td></tr>`
  ).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#222;font-size:11pt;line-height:1.45}
    header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:20px}
    header img{display:block;max-width:240px;max-height:110px;object-fit:contain}.document-meta{text-align:right}
    h1{font-size:20pt;margin:0}h2{font-size:13pt;margin-top:20px}
    table{width:100%;border-collapse:collapse}td{padding:6px;border-bottom:1px solid #ddd}
    td:last-child{text-align:right}.accept{margin-top:28px;border-top:1px solid #999;padding-top:14px}
    .proposal-details-area,.proposal-summary-area{margin-top:22px;border-radius:8px;padding:14px 16px}
    .proposal-details-area{border:1px solid #bccbd7;border-top:4px solid #315d7d;background:#fbfcfd}
    .proposal-summary-area{border:2px solid #315d7d;background:#edf3f7;page-break-inside:avoid}
    .proposal-section-heading{margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #c5d2dc}
    .proposal-section-label{color:#315d7d;font-size:8pt;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase}
    .proposal-section-heading h2{margin:3px 0}.proposal-section-heading p{margin:0;color:#5d6b78;font-size:9pt}
    .proposal-summary-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #c5d2dc}
    .proposal-summary-row.total{margin-top:3px;padding-top:9px;border-top:2px solid #315d7d;border-bottom:0;color:#17364f;font-size:13pt}
    .proposal-commercial-terms{display:flex;gap:30px;margin-top:12px;padding-top:10px;border-top:1px solid #c5d2dc;font-size:9pt}
    .proposal-terms{page-break-before:always}.proposal-terms p{font-size:9pt;line-height:1.45}
  </style></head><body>
    <header><img src="${hasaLogoDataUri}" alt="HASA Concepts">
    <div class="document-meta"><h1>STATEMENT OF WORK</h1><div>Proposal #${escapeHtml(data.proposal.proposal_number)} · ${escapeHtml(proposalRevisionLabel(data.revision.revision_number))}</div></div></header>
    <h2>${escapeHtml(data.proposal.project_name)}</h2>
    <p>Client: ${escapeHtml(data.proposal.client?.company_name ?? "")}</p>
    <section class="proposal-details-area">
      <div class="proposal-section-heading"><span class="proposal-section-label">Proposal Details</span><h2>Scope and Pricing Details</h2><p>The proposed work and itemized pricing are shown below.</p></div>
      ${sections}
      <h2>Professional Fees</h2><table><thead><tr><td>Description</td><td>Pricing Basis</td><td>Quantity</td><td>Rate</td><td>Amount</td></tr></thead><tbody>${fees}</tbody></table>
      ${materials ? `<h2>Materials</h2><table><thead><tr><td>Description</td><td>Quantity</td><td>Bid Unit Price</td><td>Amount</td></tr></thead><tbody>${materials}</tbody></table>` : ""}
      <h2>Estimated Expenses</h2><table><thead><tr><td>Category</td><td>Description</td><td>Quantity</td><td>Unit Cost</td><td>Estimate</td></tr></thead><tbody>${expenses}</tbody></table>
    </section>
    <section class="proposal-summary-area">
      <div class="proposal-section-heading"><span class="proposal-section-label">Proposal Summary</span><h2>Investment and Commercial Terms</h2><p>This summary identifies the proposed total, payment terms, and validity period.</p></div>
      <div class="proposal-summary-row"><span>Professional Fee</span><strong>${money(data.revision.professional_fee)}</strong></div>
      ${showMaterialsSummary ? `<div class="proposal-summary-row"><span>Estimated Materials</span><strong>${money(data.revision.estimated_materials)}</strong></div>` : ""}
      <div class="proposal-summary-row"><span>Estimated Expenses</span><strong>${money(data.revision.estimated_expenses)}</strong></div>
      <div class="proposal-summary-row total"><span>Estimated Total</span><strong>${money(data.revision.estimated_total)}</strong></div>
      <div class="proposal-commercial-terms"><span><strong>Payment Terms:</strong> ${escapeHtml(data.revision.payment_terms ?? "")}</span><span><strong>Proposal Validity:</strong> ${escapeHtml(data.revision.validity_days ?? "")} days</span></div>
    </section>
    <div class="accept"><strong>Electronically Accepted</strong><br>
    ${escapeHtml(signer.signerName)}${signer.signerTitle ? `, ${escapeHtml(signer.signerTitle)}` : ""}<br>
    ${new Date().toISOString()}</div>
    ${proposalTermsSection}
  </body></html>`;
}

export function executedAuthorizationHtml(data: any, signer: any) {
  const a = data.authorization;
  const hasaLogoDataUri = hasaHorizontalLogoDataUri();
  const labor = (a.labor_items ?? []).map((item:any) =>
    `<tr><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.hours)}</td><td>${money(item.rate)}</td><td>${money(item.amount)}</td></tr>`
  ).join("");
  const expenses = (a.expense_items ?? []).map((item:any) =>
    `<tr><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.description ?? "")}</td><td>${escapeHtml(item.estimated_quantity)} ${escapeHtml(item.unit ?? "")}</td><td>${money(item.estimated_rate)}</td><td>${money(item.estimated_amount)}</td></tr>`
  ).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#222;font-size:11pt;line-height:1.45}
    header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:20px}
    header img{display:block;max-width:240px;max-height:110px;object-fit:contain}.document-meta{text-align:right}
    h1{font-size:20pt}h2{font-size:13pt;margin-top:20px}
    table{width:100%;border-collapse:collapse}td{padding:6px;border-bottom:1px solid #ddd}td:last-child{text-align:right}
    .accept{margin-top:28px;border-top:1px solid #999;padding-top:14px}
  </style></head><body>
    <header><img src="${hasaLogoDataUri}" alt="HASA Concepts"><div class="document-meta">Authorization #${escapeHtml(a.authorization_number)}</div></header>
    <h1>Additional Service Authorization</h1>
    <p><strong>Project:</strong> ${escapeHtml(a.project?.project_number ?? "")} — ${escapeHtml(a.project?.project_name ?? "")}</p>
    <p>${escapeHtml(a.description ?? "").replace(/\n/g,"<br>")}</p>
    ${labor ? `<h2>Services and Labor</h2><table><thead><tr><td>Description</td><td>Hours</td><td>Rate</td><td>Amount</td></tr></thead><tbody>${labor}</tbody></table>` : ""}
    ${expenses ? `<h2>Estimated Expenses</h2><table><thead><tr><td>Category</td><td>Description</td><td>Quantity</td><td>Unit Cost</td><td>Estimate</td></tr></thead><tbody>${expenses}</tbody></table>` : ""}
    <p><strong>Billing Type:</strong> ${escapeHtml(a.billing_type)}<br>
    <strong>Authorized Amount:</strong> ${money(a.authorized_amount)}</p>
    <div class="accept"><strong>Electronically Accepted</strong><br>
    ${escapeHtml(signer.signerName)}${signer.signerTitle ? `, ${escapeHtml(signer.signerTitle)}` : ""}<br>
    ${new Date().toISOString()}</div>
  </body></html>`;
}

function escapeHtml(v: any) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c] as string));
}

function serviceBillingLabel(value: any) {
  if (value === "unit") return "Per Unit";
  if (value === "fixed") return "Fixed Fee";
  if (value === "included") return "Included";
  return "Hourly";
}
