import { money } from "@/lib/ui/format";
import { proposalRevisionLabel } from "@/lib/proposal-revisions";
import { hasaHorizontalLogoDataUri } from "@/lib/branding/assets";
import type { AlternateSelection } from "@/lib/proposal-alternates";

type AcceptedProposalMetadata = {
  acceptanceVersionId: string;
  acceptedAt: string;
  selection: AlternateSelection;
};

export function executedProposalHtml(
  data: any,
  signer: any,
  metadata: AcceptedProposalMetadata,
) {
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
  const sections = (data.sections ?? []).map((section: any) =>
    `<section><h2>${escapeHtml(section.heading ?? section.section_type)}</h2><p>${escapeHtml(section.content ?? "").replace(/\n/g, "<br>")}</p></section>`
  ).join("");

  const fees = (data.fees ?? []).map((fee: any) =>
    `<tr><td>${escapeHtml(fee.description)}</td><td>${escapeHtml(serviceBillingLabel(fee.billing_type))}</td><td>${escapeHtml(fee.quantity)} ${escapeHtml(fee.unit ?? "")}</td><td>${fee.billing_type === "included" ? "Included" : money(fee.rate)}</td><td>${fee.billing_type === "included" ? "Included" : money(fee.amount)}</td></tr>`
  ).join("");

  const expenses = (data.expenses ?? []).map((expense: any) =>
    `<tr><td>${escapeHtml(expense.category)}</td><td>${escapeHtml(expense.description ?? "")}</td><td>${escapeHtml(expense.estimated_quantity)} ${escapeHtml(expense.unit ?? "")}</td><td>${money(expense.estimated_rate)}</td><td>${money(expense.estimated_amount)}</td></tr>`
  ).join("");

  const materials = (data.materials ?? []).map((material: any) =>
    `<tr><td>${escapeHtml(material.description)}</td><td>${escapeHtml(material.quantity)} ${escapeHtml(material.unit)}</td><td>${money(material.unit_price)}</td><td>${money(material.amount)}</td></tr>`
  ).join("");

  const selectedAlternates = metadata.selection.selected.map((alternate) =>
    `<tr><td><strong>${escapeHtml(alternate.title)}</strong>${alternate.description ? `<br><span class="muted">${escapeHtml(alternate.description)}</span>` : ""}</td><td class="decision selected">Selected</td><td>+${money(alternate.amount)}</td></tr>`
  ).join("");
  const declinedAlternates = metadata.selection.declined.map((alternate) =>
    `<tr><td><strong>${escapeHtml(alternate.title)}</strong>${alternate.description ? `<br><span class="muted">${escapeHtml(alternate.description)}</span>` : ""}</td><td class="decision declined">Declined</td><td>+${money(alternate.amount)}</td></tr>`
  ).join("");
  const allAlternates = selectedAlternates + declinedAlternates;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#222;font-size:10pt;line-height:1.42}
    header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:20px}
    header img{display:block;max-width:240px;max-height:110px;object-fit:contain}.document-meta{text-align:right}
    h1{font-size:20pt;margin:0}h2{font-size:13pt;margin-top:20px}
    table{width:100%;border-collapse:collapse}th,td{padding:6px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}
    th:last-child,td:last-child{text-align:right}.muted{color:#5d6b78;font-size:8.5pt}
    .proposal-details-area,.proposal-summary-area,.acceptance-record{margin-top:22px;border-radius:8px;padding:14px 16px}
    .proposal-details-area{border:1px solid #bccbd7;border-top:4px solid #315d7d;background:#fbfcfd}
    .proposal-summary-area{border:2px solid #315d7d;background:#edf3f7;page-break-inside:avoid}
    .proposal-section-heading{margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #c5d2dc}
    .proposal-section-label{color:#315d7d;font-size:8pt;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase}
    .proposal-section-heading h2{margin:3px 0}.proposal-section-heading p{margin:0;color:#5d6b78;font-size:9pt}
    .proposal-summary-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #c5d2dc}
    .proposal-summary-row.total{margin-top:3px;padding-top:9px;border-top:2px solid #315d7d;border-bottom:0;color:#17364f;font-size:13pt}
    .proposal-commercial-terms{display:flex;gap:30px;margin-top:12px;padding-top:10px;border-top:1px solid #c5d2dc;font-size:9pt}
    .alternate-decisions{page-break-inside:avoid}.decision{font-weight:bold}.selected{color:#17633f}.declined{color:#8f1d18}
    .acceptance-record{border:2px solid #21845a;background:#f2fbf6;page-break-inside:avoid}
    .acceptance-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px 24px}.signature{margin-top:14px;padding-top:10px;border-top:1px solid #91c8aa;font-size:15pt;font-weight:bold}
    .proposal-terms{page-break-before:always}.proposal-terms p{font-size:9pt;line-height:1.45}
  </style></head><body>
    <header><img src="${hasaLogoDataUri}" alt="HASA Concepts">
    <div class="document-meta"><h1>ACCEPTED PROPOSAL</h1><div>Proposal #${escapeHtml(data.proposal.proposal_number)} · ${escapeHtml(proposalRevisionLabel(data.revision.revision_number))}</div><div>Acceptance ID: ${escapeHtml(metadata.acceptanceVersionId)}</div></div></header>
    <h2>${escapeHtml(data.proposal.project_name)}</h2>
    <p><strong>Client:</strong> ${escapeHtml(data.proposal.client?.company_name ?? "")}<br>
    ${data.proposal.project_location ? `<strong>Project Location:</strong> ${escapeHtml(data.proposal.project_location)}<br>` : ""}
    <strong>Proposal Date:</strong> ${escapeHtml(data.revision.revision_date ?? "")}</p>
    <section class="proposal-details-area">
      <div class="proposal-section-heading"><span class="proposal-section-label">Proposal Details</span><h2>Scope and Pricing Details</h2><p>The accepted work and itemized base pricing are shown below.</p></div>
      ${sections}
      <h2>Professional Fees</h2><table><thead><tr><th>Description</th><th>Pricing Basis</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${fees}</tbody></table>
      ${materials ? `<h2>Materials</h2><table><thead><tr><th>Description</th><th>Quantity</th><th>Bid Unit Price</th><th>Amount</th></tr></thead><tbody>${materials}</tbody></table>` : ""}
      <h2>Estimated Expenses</h2><table><thead><tr><th>Category</th><th>Description</th><th>Quantity</th><th>Unit Cost</th><th>Estimate</th></tr></thead><tbody>${expenses}</tbody></table>
    </section>
    <section class="alternate-decisions">
      <h2>Final Alternate Choices</h2>
      <p><strong>Selected Alternates</strong> and <strong>Declined Alternates</strong> are recorded below as part of this accepted contract.</p>
      ${allAlternates ? `<table><thead><tr><th>Alternate</th><th>Decision</th><th>Price</th></tr></thead><tbody>${allAlternates}</tbody></table>` : "<p>No optional alternates were offered with this proposal.</p>"}
    </section>
    <section class="proposal-summary-area">
      <div class="proposal-section-heading"><span class="proposal-section-label">Accepted Contract Summary</span><h2>Final Investment and Commercial Terms</h2><p>This total reflects the required base proposal and the customer’s final alternate choices.</p></div>
      <div class="proposal-summary-row"><span>Professional Fee</span><strong>${money(data.revision.professional_fee)}</strong></div>
      ${showMaterialsSummary ? `<div class="proposal-summary-row"><span>Estimated Materials</span><strong>${money(data.revision.estimated_materials)}</strong></div>` : ""}
      <div class="proposal-summary-row"><span>Estimated Expenses</span><strong>${money(data.revision.estimated_expenses)}</strong></div>
      <div class="proposal-summary-row"><span>Base Contract</span><strong>${money(data.revision.estimated_total)}</strong></div>
      <div class="proposal-summary-row"><span>Selected Alternates</span><strong>${money(metadata.selection.alternateTotal)}</strong></div>
      <div class="proposal-summary-row total"><span>Total Accepted Contract</span><strong>${money(metadata.selection.acceptedTotal)}</strong></div>
      <div class="proposal-commercial-terms"><span><strong>Payment Terms:</strong> ${escapeHtml(data.revision.payment_terms ?? "")}</span><span><strong>Proposal Validity:</strong> ${escapeHtml(data.revision.validity_days ?? "")} days</span></div>
    </section>
    <section class="acceptance-record">
      <span class="proposal-section-label">Electronic Acceptance Record</span>
      <h2>Accepted and Authorized</h2>
      <div class="acceptance-grid">
        <div><strong>Accepted by:</strong> ${escapeHtml(signer.signerName)}</div>
        <div><strong>Title:</strong> ${escapeHtml(signer.signerTitle ?? "")}</div>
        <div><strong>Email:</strong> ${escapeHtml(signer.signerEmail ?? "")}</div>
        <div><strong>Mobile:</strong> ${escapeHtml(signer.signerMobile ?? "")}</div>
        <div><strong>Accepted at:</strong> ${escapeHtml(metadata.acceptedAt)}</div>
        <div><strong>Acceptance ID:</strong> ${escapeHtml(metadata.acceptanceVersionId)}</div>
      </div>
      <p><strong>Acceptance statement:</strong> ${escapeHtml(signer.acceptanceStatement)}</p>
      <div class="signature">/s/ ${escapeHtml(signer.signerName)}</div>
      <p class="muted">Typed electronic signature · Exact proposal state, choices, total, and metadata retained in the HASA Concepts acceptance record.</p>
    </section>
    ${proposalTermsSection}
  </body></html>`;
}

export function executedAuthorizationHtml(data: any, signer: any) {
  const authorization = data.authorization;
  const hasaLogoDataUri = hasaHorizontalLogoDataUri();
  const labor = (authorization.labor_items ?? []).map((item: any) =>
    `<tr><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.hours)}</td><td>${money(item.rate)}</td><td>${money(item.amount)}</td></tr>`
  ).join("");
  const expenses = (authorization.expense_items ?? []).map((item: any) =>
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
    <header><img src="${hasaLogoDataUri}" alt="HASA Concepts"><div class="document-meta">Authorization #${escapeHtml(authorization.authorization_number)}</div></header>
    <h1>Additional Service Authorization</h1>
    <p><strong>Project:</strong> ${escapeHtml(authorization.project?.project_number ?? "")} — ${escapeHtml(authorization.project?.project_name ?? "")}</p>
    <p>${escapeHtml(authorization.description ?? "").replace(/\n/g, "<br>")}</p>
    ${labor ? `<h2>Services and Labor</h2><table><thead><tr><td>Description</td><td>Hours</td><td>Rate</td><td>Amount</td></tr></thead><tbody>${labor}</tbody></table>` : ""}
    ${expenses ? `<h2>Estimated Expenses</h2><table><thead><tr><td>Category</td><td>Description</td><td>Quantity</td><td>Unit Cost</td><td>Estimate</td></tr></thead><tbody>${expenses}</tbody></table>` : ""}
    <p><strong>Billing Type:</strong> ${escapeHtml(authorization.billing_type)}<br>
    <strong>Authorized Amount:</strong> ${money(authorization.authorized_amount)}</p>
    <div class="accept"><strong>Electronically Accepted</strong><br>
    ${escapeHtml(signer.signerName)}${signer.signerTitle ? `, ${escapeHtml(signer.signerTitle)}` : ""}<br>
    ${new Date().toISOString()}</div>
  </body></html>`;
}

function escapeHtml(value: any) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character] as string));
}

function serviceBillingLabel(value: any) {
  if (value === "unit") return "Per Unit";
  if (value === "fixed") return "Fixed Fee";
  if (value === "included") return "Included";
  return "Hourly";
}
