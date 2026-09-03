import Link from "next/link";
import { Panel } from "@/components/cards";
import { ProposalSummary } from "@/components/proposals/proposal-summary";
import { CreateRevisionButton } from "@/components/proposals/revision-button";
import { DeleteProposalButton } from "@/components/proposals/delete-proposal-button";
import { DeleteRevisionButton } from "@/components/proposals/delete-revision-button";
import { SendProposalButton } from "@/components/proposals/send-proposal-button";
import { RevisionPaymentTermsForm } from "@/components/forms/revision-payment-terms-form";
import { ProposalRevisionForm } from "@/components/forms/proposal-revision-form";
import { ProposalPrimaryContactForm } from "@/components/forms/proposal-primary-contact-form";
import { ManualProposalAuthorizationForm } from "@/components/proposals/manual-proposal-authorization-form";
import { getProposalDetail } from "@/lib/data/detail-data";
import { parsePaymentTerms } from "@/lib/payment-terms";
import {
  normalizeRelatedContact,
  selectDefaultProposalContact,
  type ProposalContactOption,
} from "@/lib/proposal-contacts";
import type { ExpenseBillingRule } from "@/lib/proposal-items";
import { parseProposalSectionType } from "@/lib/proposal-sections";
import { proposalRevisionLabel } from "@/lib/proposal-revisions";
import { dateTime, money } from "@/lib/ui/format";
import { isTwilioConfigured } from "@/lib/messaging/twilio";
import { isTransactionalEmailConfigured } from "@/lib/messaging/email";

type SectionRecord = {
  id: string;
  proposal_revision_id: string;
  section_type: string;
  heading: string | null;
  content: string;
};

type FeeRecord = {
  id: string;
  proposal_revision_id: string;
  description: string;
  quantity: number | string | null;
  rate: number | string | null;
};

type ExpenseRecord = {
  id: string;
  proposal_revision_id: string;
  category: string;
  description: string | null;
  estimated_quantity: number | string | null;
  unit: string | null;
  estimated_rate: number | string | null;
  billing_rule: ExpenseBillingRule;
  markup_percent: number | string | null;
  requires_receipt: boolean;
};

type MaterialRecord = {
  id: string;
  proposal_revision_id: string;
  description: string;
  quantity: number | string;
  unit: string;
  unit_cost: number | string;
  markup_percent: number | string;
  unit_price: number | string;
  amount: number | string;
};

type AcceptanceRecord = {
  id: string;
  proposal_revision_id: string;
  signer_name: string;
  signer_title: string | null;
  signer_email: string | null;
  signer_mobile: string | null;
  accepted_at: string;
  authorization_method: "electronic" | "verbal" | "email";
  recorded_at: string | null;
  recording_notes: string | null;
  recorded_by_user: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | Array<{
    first_name: string | null;
    last_name: string | null;
    email: string;
  }> | null;
  evidence_document: {
    id: string;
    title: string;
    original_filename: string | null;
  } | Array<{
    id: string;
    title: string;
    original_filename: string | null;
  }> | null;
};

function relatedOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function authorizationMethodLabel(method: AcceptanceRecord["authorization_method"]) {
  if (method === "verbal") return "Verbal";
  if (method === "email") return "Email";
  return "Electronic";
}

export default async function ProposalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ proposalId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { proposalId } = await params;
  const { edit } = await searchParams;
  const d = await getProposalDetail(proposalId);
  const latest = d.revisions[0];
  const contacts = d.contacts as ProposalContactOption[];
  const primaryContact = normalizeRelatedContact(d.proposal.primary_contact)
    ?? selectDefaultProposalContact(contacts);
  const latestLabel = latest ? proposalRevisionLabel(latest.revision_number) : "Proposal";
  const showEditor = Boolean(latest && !latest.locked && edit !== "0");
  const canOfferProposalDeletion = Boolean(
    latest
    && d.proposal.status === "draft"
    && d.proposal.proposal_number === d.latestAnnualProposalNumber
    && d.revisions.every((revision: { locked: boolean }) => !revision.locked)
    && d.acceptances.length === 0
  );
  const scopeSections = latest ? (d.sections as SectionRecord[])
    .filter((section) => section.proposal_revision_id === latest.id)
    .map((section) => ({
      id: section.id,
      sectionType: parseProposalSectionType(section.section_type),
      heading: String(section.heading ?? ""),
      content: section.content,
    })) : [];
  const laborLines = latest ? (d.fees as FeeRecord[])
    .filter((fee) => fee.proposal_revision_id === latest.id)
    .map((fee) => ({
      id: fee.id,
      description: fee.description,
      hours: String(fee.quantity ?? ""),
      rate: String(fee.rate ?? ""),
    })) : [];
  const expenseLines = latest ? (d.expenses as ExpenseRecord[])
    .filter((expense) => expense.proposal_revision_id === latest.id)
    .map((expense) => ({
      id: expense.id,
      category: expense.category,
      description: String(expense.description ?? ""),
      quantity: String(expense.estimated_quantity ?? "1"),
      unit: String(expense.unit ?? ""),
      rate: String(expense.estimated_rate ?? ""),
      billingRule: expense.billing_rule,
      markupPercent: String(expense.markup_percent ?? "0"),
      requiresReceipt: Boolean(expense.requires_receipt),
    })) : [];
  const materialLines = latest ? (d.materials as MaterialRecord[])
    .filter((material) => material.proposal_revision_id === latest.id)
    .map((material) => ({
      id: material.id,
      description: material.description,
      quantity: String(material.quantity ?? "1"),
      unit: material.unit,
      unitCost: String(material.unit_cost ?? ""),
      markupPercent: String(material.markup_percent ?? "0"),
    })) : [];
  const acceptances = d.acceptances as AcceptanceRecord[];
  const acceptanceByRevision = new Map(
    acceptances.map((acceptance) => [acceptance.proposal_revision_id, acceptance]),
  );
  const latestAcceptance = latest ? acceptanceByRevision.get(latest.id) : null;
  const canRecoverAuthorization = Boolean(
    latest
    && latest.locked
    && !latestAcceptance
    && ["sent", "viewed", "changes_requested"].includes(d.proposal.status)
  );
  const canSendProposal = Boolean(
    latest
    && ((!latest.locked && d.proposal.status === "draft") || canRecoverAuthorization)
  );

  return (
    <>
      <div className="page-heading">
        <div><h1>Proposal {d.proposal.proposal_number}</h1><p>{d.proposal.project_name}</p></div>
      </div>

      <section className="proposal-area proposal-work-area" aria-labelledby="proposal-work-area-title">
        <header className="proposal-area-heading">
          <div>
            <span className="proposal-area-eyebrow">Proposal Work Area</span>
            <h2 id="proposal-work-area-title">Build and manage {latestLabel}</h2>
            <p>{latest?.locked
              ? "This proposal version is locked because it has been sent. Create a revision to make changes."
              : "Contact, scope, hours, rates, materials, expenses, and terms remain editable here until this version is sent."}</p>
          </div>
          <div className="button-row proposal-area-actions">
          {latest && !latest.locked && !showEditor ? (
            <Link className="secondary-button" href={`/proposals/${proposalId}?edit=1`}>
              Edit Revision
            </Link>
          ) : null}
          {latest ? (
            <Link
              aria-label="Preview customer view (opens in a new tab)"
              className="secondary-button"
              href={`/proposal-previews/${proposalId}`}
              rel="noreferrer"
              target="_blank"
            >
              Preview Customer View
            </Link>
          ) : null}
          {canSendProposal && latest ? (
            <SendProposalButton
              proposalId={proposalId}
              revisionId={latest.id}
              hasEmail={Boolean(primaryContact?.email)}
              hasMobile={Boolean(primaryContact?.mobile_phone)}
              emailConfigured={isTransactionalEmailConfigured()}
              smsConfigured={isTwilioConfigured()}
              isResend={latest.locked}
            />
          ) : null}
          {latest && !latest.locked && latest.revision_number > 1 ? (
            <DeleteRevisionButton
              proposalId={proposalId}
              revisionNumber={latest.revision_number}
            />
          ) : null}
          {canOfferProposalDeletion ? (
            <DeleteProposalButton
              proposalId={proposalId}
              proposalNumber={d.proposal.proposal_number}
              clientId={d.proposal.client_id}
            />
          ) : null}
          <CreateRevisionButton proposalId={proposalId} />
          </div>
        </header>

        {latest ? (
          <Panel title="Proposal Contact">
            <ProposalPrimaryContactForm
              proposalId={proposalId}
              contacts={contacts}
              primaryContactId={primaryContact?.id ?? ""}
              locked={latest.locked}
            />
          </Panel>
        ) : null}

        {showEditor && latest ? (
          <Panel title={`Edit ${latestLabel}`}>
            <p className="footnote">This draft remains editable until it is sent. Sending permanently locks this proposal version.</p>
            <ProposalRevisionForm
              proposalId={proposalId}
              revision={{
                id: latest.id,
                revision_number: latest.revision_number,
                payment_terms: parsePaymentTerms(latest.payment_terms),
                validity_days: latest.validity_days,
                billing_method: latest.billing_method,
              }}
              scopeSections={scopeSections}
              laborLines={laborLines}
              expenseLines={expenseLines}
              materialLines={materialLines}
            />
          </Panel>
        ) : null}

        {latest ? (
          <Panel title={`${latestLabel} Payment Terms`}>
            <RevisionPaymentTermsForm
              revisionId={latest.id}
              paymentTerms={latest.payment_terms}
              locked={latest.locked}
            />
            <p className="footnote">
              Sent and accepted proposal versions are locked permanently. A new revision copies the prior terms and remains editable until it is sent.
              Unlocked revisions can be deleted in reverse order, beginning with the latest revision. The Original Proposal remains until the entire unissued draft proposal is deleted.
            </p>
          </Panel>
        ) : null}

        {canRecoverAuthorization && latest ? (
          <Panel title="Authorization Recovery">
            <p className="manual-authorization-intro">
              If the customer did not receive the proposal, use <strong>Resend Proposal</strong> above to issue a fresh secure link.
              If the customer already authorized this exact version verbally or by email, record that authorization below.
            </p>
            <ManualProposalAuthorizationForm
              proposalId={proposalId}
              revisionId={latest.id}
              defaultSigner={{
                name: [primaryContact?.first_name, primaryContact?.last_name].filter(Boolean).join(" "),
                title: "",
                email: primaryContact?.email ?? "",
                mobile: primaryContact?.mobile_phone ?? "",
              }}
            />
          </Panel>
        ) : null}
      </section>

      <section className="proposal-area proposal-summary-area" aria-labelledby="proposal-summary-area-title">
        <header className="proposal-area-heading">
          <div>
            <span className="proposal-area-eyebrow">Proposal Summary</span>
            <h2 id="proposal-summary-area-title">Review the current customer-facing content</h2>
            <p>Use this read-only area to confirm totals, scope, fees, materials, expenses, terms, and revision history.</p>
          </div>
          <span className="proposal-area-badge">Read-only review</span>
        </header>

        {latest ? <ProposalSummary revision={latest} /> : null}

        <Panel title="Proposal Version History">
          <div className="table-wrap"><table><thead><tr><th>Version</th><th>Date</th><th>Fee</th><th>Materials</th><th>Expenses</th><th>Total</th><th>Terms</th><th>Locked</th><th>Approved By</th><th>Approval Date</th></tr></thead>
          <tbody>{d.revisions.map((r:any)=>{const acceptance=acceptanceByRevision.get(r.id);return <tr key={r.id}><td>{proposalRevisionLabel(r.revision_number)}</td><td>{r.revision_date}</td><td>{money(r.professional_fee)}</td><td>{money(r.estimated_materials)}</td><td>{money(r.estimated_expenses)}</td><td>{money(r.estimated_total)}</td><td>{r.payment_terms}</td><td>{r.locked?"Yes":"No"}</td><td>{acceptance?.signer_name??"—"}</td><td>{dateTime(acceptance?.accepted_at)}</td></tr>})}</tbody></table></div>
        </Panel>

        {acceptances.length ? (
          <Panel title="Customer Authorization Records">
            <p className="footnote">Electronic, verbal, and email authorizations are identified separately. Manual records show who entered them and link to supporting evidence when provided.</p>
            <div className="table-wrap"><table><thead><tr><th>Version</th><th>Method</th><th>Authorized</th><th>Customer</th><th>Title</th><th>Email</th><th>Mobile</th><th>Recorded By</th><th>Recorded</th><th>Evidence</th><th>Notes</th></tr></thead>
            <tbody>{acceptances.map((acceptance)=>{const revision=d.revisions.find((item:any)=>item.id===acceptance.proposal_revision_id);const recorder=relatedOne(acceptance.recorded_by_user);const evidence=relatedOne(acceptance.evidence_document);return <tr key={acceptance.id}><td>{revision?proposalRevisionLabel(revision.revision_number):"Proposal"}</td><td>{authorizationMethodLabel(acceptance.authorization_method)}</td><td>{dateTime(acceptance.accepted_at)}</td><td>{acceptance.signer_name}</td><td>{acceptance.signer_title??"—"}</td><td>{acceptance.signer_email??"—"}</td><td>{acceptance.signer_mobile??"—"}</td><td>{recorder?[recorder.first_name,recorder.last_name].filter(Boolean).join(" ")||recorder.email:"Customer"}</td><td>{dateTime(acceptance.recorded_at)}</td><td>{evidence?<Link className="table-link" href={`/api/documents/${evidence.id}/download`} rel="noreferrer" target="_blank">{evidence.original_filename??"Open evidence"}</Link>:"—"}</td><td>{acceptance.recording_notes??"—"}</td></tr>})}</tbody></table></div>
          </Panel>
        ) : null}

        {d.deliveries.length ? (
          <Panel title="Proposal Delivery History">
            <div className="table-wrap"><table><thead><tr><th>Sent</th><th>Method</th><th>Recipient</th><th>Address</th><th>Status</th><th>Details</th></tr></thead>
            <tbody>{d.deliveries.map((delivery:any)=><tr key={delivery.id}><td>{dateTime(delivery.sent_at??delivery.created_at)}</td><td className="capitalize">{String(delivery.delivery_method).replaceAll("_"," ")}</td><td>{delivery.recipient_name||"—"}</td><td>{delivery.recipient_address}</td><td className="capitalize">{delivery.status}</td><td>{delivery.error_message??"—"}</td></tr>)}</tbody></table></div>
          </Panel>
        ) : null}

        {latest ? <>
          <Panel title="Scope">
            {d.sections.filter((s:any)=>s.proposal_revision_id===latest.id).map((s:any)=><div key={s.id} className="scope-block"><h3>{s.heading??s.section_type}</h3><p className="preline">{s.content}</p></div>)}
          </Panel>

          <Panel title="Professional Fees">
            <div className="table-wrap"><table><thead><tr><th>Description</th><th>Hours</th><th>Hourly Rate</th><th>Amount</th></tr></thead>
            <tbody>{d.fees.filter((f:any)=>f.proposal_revision_id===latest.id).map((f:any)=><tr key={f.id}><td>{f.description}</td><td>{Number(f.quantity)}</td><td>{money(f.rate)}</td><td>{money(f.amount)}</td></tr>)}</tbody></table></div>
          </Panel>

          <Panel title="Materials">
            <div className="table-wrap"><table><thead><tr><th>Material</th><th>Qty</th><th>Unit</th><th>Unit Cost</th><th>Markup</th><th>Bid Unit Price</th><th>Amount</th></tr></thead>
            <tbody>{d.materials.filter((m:any)=>m.proposal_revision_id===latest.id).map((m:any)=><tr key={m.id}><td>{m.description}</td><td>{Number(m.quantity)}</td><td>{m.unit}</td><td>{money(m.unit_cost)}</td><td>{Number(m.markup_percent)}%</td><td>{money(m.unit_price)}</td><td>{money(m.amount)}</td></tr>)}</tbody></table></div>
          </Panel>

          <Panel title="Estimated Expenses">
            <div className="table-wrap"><table><thead><tr><th>Category</th><th>Description</th><th>Qty</th><th>Unit</th><th>Unit Cost</th><th>Markup</th><th>Rule</th><th>Estimate</th></tr></thead>
            <tbody>{d.expenses.filter((e:any)=>e.proposal_revision_id===latest.id).map((e:any)=><tr key={e.id}><td>{e.category}</td><td>{e.description??"—"}</td><td>{Number(e.estimated_quantity)}</td><td>{e.unit??"—"}</td><td>{money(e.estimated_rate)}</td><td>{Number(e.markup_percent)}%</td><td>{String(e.billing_rule).replaceAll("_", " ")}</td><td>{money(e.estimated_amount)}</td></tr>)}</tbody></table></div>
          </Panel>
        </> : null}
      </section>
    </>
  );
}
