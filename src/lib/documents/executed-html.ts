import { money } from "@/lib/ui/format";
import { proposalRevisionLabel } from "@/lib/proposal-revisions";
import { hasaHorizontalLogoDataUri } from "@/lib/branding/assets";

export function executedProposalHtml(data: any, signer: any) {
  const hasaLogoDataUri = hasaHorizontalLogoDataUri();
  const sections = (data.sections ?? []).map((s:any) =>
    `<section><h2>${escapeHtml(s.heading ?? s.section_type)}</h2><p>${escapeHtml(s.content ?? "").replace(/\n/g,"<br>")}</p></section>`
  ).join("");

  const fees = (data.fees ?? []).map((f:any) =>
    `<tr><td>${escapeHtml(f.description)}</td><td>${escapeHtml(f.quantity)}</td><td>${money(f.rate)}</td><td>${money(f.amount)}</td></tr>`
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
  </style></head><body>
    <header><img src="${hasaLogoDataUri}" alt="HASA Concepts">
    <div class="document-meta"><h1>STATEMENT OF WORK</h1><div>Proposal #${escapeHtml(data.proposal.proposal_number)} · ${escapeHtml(proposalRevisionLabel(data.revision.revision_number))}</div></div></header>
    <h2>${escapeHtml(data.proposal.project_name)}</h2>
    <p>Client: ${escapeHtml(data.proposal.client?.company_name ?? "")}</p>
    ${sections}
    <h2>Professional Fees</h2><table><thead><tr><td>Description</td><td>Hours</td><td>Rate</td><td>Amount</td></tr></thead><tbody>${fees}</tbody></table>
    ${materials ? `<h2>Materials</h2><table><thead><tr><td>Description</td><td>Quantity</td><td>Bid Unit Price</td><td>Amount</td></tr></thead><tbody>${materials}</tbody></table>` : ""}
    <h2>Estimated Expenses</h2><table><thead><tr><td>Category</td><td>Description</td><td>Quantity</td><td>Unit Cost</td><td>Estimate</td></tr></thead><tbody>${expenses}</tbody></table>
    <p><strong>Professional Fee:</strong> ${money(data.revision.professional_fee)}<br>
    <strong>Estimated Materials:</strong> ${money(data.revision.estimated_materials)}<br>
    <strong>Estimated Expenses:</strong> ${money(data.revision.estimated_expenses)}<br>
    <strong>Estimated Total:</strong> ${money(data.revision.estimated_total)}<br>
    <strong>Terms:</strong> ${escapeHtml(data.revision.payment_terms ?? "")}</p>
    <div class="accept"><strong>Electronically Accepted</strong><br>
    ${escapeHtml(signer.signerName)}${signer.signerTitle ? `, ${escapeHtml(signer.signerTitle)}` : ""}<br>
    ${new Date().toISOString()}</div>
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
