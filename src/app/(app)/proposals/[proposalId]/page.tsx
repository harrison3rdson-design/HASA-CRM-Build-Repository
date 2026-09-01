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
import { money } from "@/lib/ui/format";
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
              : "Contact, scope, hours, rates, expenses, and terms remain editable here until this version is sent."}</p>
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
          {latest && !latest.locked ? (
            <SendProposalButton
              proposalId={proposalId}
              revisionId={latest.id}
              hasEmail={Boolean(primaryContact?.email)}
              hasMobile={Boolean(primaryContact?.mobile_phone)}
              emailConfigured={isTransactionalEmailConfigured()}
              smsConfigured={isTwilioConfigured()}
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
      </section>

      <section className="proposal-area proposal-summary-area" aria-labelledby="proposal-summary-area-title">
        <header className="proposal-area-heading">
          <div>
            <span className="proposal-area-eyebrow">Proposal Summary</span>
            <h2 id="proposal-summary-area-title">Review the current customer-facing content</h2>
            <p>Use this read-only area to confirm totals, scope, fees, expenses, terms, and revision history.</p>
          </div>
          <span className="proposal-area-badge">Read-only review</span>
        </header>

        {latest ? <ProposalSummary revision={latest} /> : null}

        <Panel title="Proposal Version History">
          <div className="table-wrap"><table><thead><tr><th>Version</th><th>Date</th><th>Fee</th><th>Expenses</th><th>Total</th><th>Terms</th><th>Locked</th></tr></thead>
          <tbody>{d.revisions.map((r:any)=><tr key={r.id}><td>{proposalRevisionLabel(r.revision_number)}</td><td>{r.revision_date}</td><td>{money(r.professional_fee)}</td><td>{money(r.estimated_expenses)}</td><td>{money(r.estimated_total)}</td><td>{r.payment_terms}</td><td>{r.locked?"Yes":"No"}</td></tr>)}</tbody></table></div>
        </Panel>

        {latest ? <>
          <Panel title="Scope">
            {d.sections.filter((s:any)=>s.proposal_revision_id===latest.id).map((s:any)=><div key={s.id} className="scope-block"><h3>{s.heading??s.section_type}</h3><p className="preline">{s.content}</p></div>)}
          </Panel>

          <Panel title="Professional Fees">
            <div className="table-wrap"><table><thead><tr><th>Description</th><th>Hours</th><th>Hourly Rate</th><th>Amount</th></tr></thead>
            <tbody>{d.fees.filter((f:any)=>f.proposal_revision_id===latest.id).map((f:any)=><tr key={f.id}><td>{f.description}</td><td>{Number(f.quantity)}</td><td>{money(f.rate)}</td><td>{money(f.amount)}</td></tr>)}</tbody></table></div>
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
