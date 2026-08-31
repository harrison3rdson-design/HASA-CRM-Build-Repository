import { money } from "@/lib/ui/format";

export function executedProposalHtml(data: any, signer: any) {
  const sections = (data.sections ?? []).map((s:any) =>
    `<section><h2>${escapeHtml(s.heading ?? s.section_type)}</h2><p>${escapeHtml(s.content ?? "").replace(/\n/g,"<br>")}</p></section>`
  ).join("");

  const fees = (data.fees ?? []).map((f:any) =>
    `<tr><td>${escapeHtml(f.description)}</td><td>${escapeHtml(f.quantity)}</td><td>${money(f.rate)}</td><td>${money(f.amount)}</td></tr>`
  ).join("");

  const expenses = (data.expenses ?? []).map((e:any) =>
    `<tr><td>${escapeHtml(e.category)}</td><td>${escapeHtml(e.description ?? "")}</td><td>${escapeHtml(e.estimated_quantity)} ${escapeHtml(e.unit ?? "")}</td><td>${money(e.estimated_rate)}</td><td>${money(e.estimated_amount)}</td></tr>`
  ).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#222;font-size:11pt;line-height:1.45}
    header{border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:20px}
    h1{font-size:20pt;margin:0}h2{font-size:13pt;margin-top:20px}
    table{width:100%;border-collapse:collapse}td{padding:6px;border-bottom:1px solid #ddd}
    td:last-child{text-align:right}.accept{margin-top:28px;border-top:1px solid #999;padding-top:14px}
  </style></head><body>
    <header><h1>STATEMENT OF WORK BY HASA CONCEPTS, LLC</h1>
    <div>Proposal #${escapeHtml(data.proposal.proposal_number)} · Revision ${data.revision.revision_number}</div></header>
    <h2>${escapeHtml(data.proposal.project_name)}</h2>
    <p>Client: ${escapeHtml(data.proposal.client?.company_name ?? "")}</p>
    ${sections}
    <h2>Professional Fees</h2><table><thead><tr><td>Description</td><td>Hours</td><td>Rate</td><td>Amount</td></tr></thead><tbody>${fees}</tbody></table>
    <h2>Estimated Expenses</h2><table><thead><tr><td>Category</td><td>Description</td><td>Quantity</td><td>Unit Cost</td><td>Estimate</td></tr></thead><tbody>${expenses}</tbody></table>
    <p><strong>Professional Fee:</strong> ${money(data.revision.professional_fee)}<br>
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
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#222;font-size:11pt;line-height:1.45}
    header{border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:20px}
    h1{font-size:20pt}.accept{margin-top:28px;border-top:1px solid #999;padding-top:14px}
  </style></head><body>
    <header><strong>HASA CONCEPTS, LLC</strong><div>${escapeHtml(a.authorization_number)}</div></header>
    <h1>Additional Service Authorization</h1>
    <p><strong>Project:</strong> ${escapeHtml(a.project?.project_number ?? "")} — ${escapeHtml(a.project?.project_name ?? "")}</p>
    <p>${escapeHtml(a.description ?? "").replace(/\n/g,"<br>")}</p>
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
