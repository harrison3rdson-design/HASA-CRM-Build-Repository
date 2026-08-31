import Link from "next/link";
import { Panel } from "@/components/cards";
import { ProposalSummary } from "@/components/proposals/proposal-summary";
import { CreateRevisionButton } from "@/components/proposals/revision-button";
import { RevisionPaymentTermsForm } from "@/components/forms/revision-payment-terms-form";
import { ProposalRevisionForm } from "@/components/forms/proposal-revision-form";
import { getProposalDetail } from "@/lib/data/detail-data";
import { parsePaymentTerms } from "@/lib/payment-terms";
import type { ExpenseBillingRule } from "@/lib/proposal-items";
import { money } from "@/lib/ui/format";

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
  const showEditor = edit === "1" && latest && !latest.locked;
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
        <div className="button-row">
          {latest && !latest.locked ? (
            <Link className="secondary-button" href={`/proposals/${proposalId}?edit=1`}>
              Edit Revision
            </Link>
          ) : null}
          <CreateRevisionButton proposalId={proposalId} />
        </div>
      </div>

      {showEditor ? (
        <Panel title={`Edit Revision ${latest.revision_number}`}>
          <p className="footnote">Changes apply only to this draft revision. Accepted revisions remain unchanged.</p>
          <ProposalRevisionForm
            proposalId={proposalId}
            revision={{
              id: latest.id,
              revision_number: latest.revision_number,
              payment_terms: parsePaymentTerms(latest.payment_terms),
              validity_days: latest.validity_days,
              billing_method: latest.billing_method,
            }}
            laborLines={laborLines}
            expenseLines={expenseLines}
          />
        </Panel>
      ) : null}

      {latest ? <ProposalSummary revision={latest} /> : null}

      {latest ? (
        <Panel title={`Revision ${latest.revision_number} Payment Terms`}>
          <RevisionPaymentTermsForm
            revisionId={latest.id}
            paymentTerms={latest.payment_terms}
            locked={latest.locked}
          />
          <p className="footnote">
            Accepted revisions are locked permanently. New revisions copy the prior revision’s terms and can be changed before acceptance.
          </p>
        </Panel>
      ) : null}

      <Panel title="Revision History">
        <div className="table-wrap"><table><thead><tr><th>Revision</th><th>Date</th><th>Fee</th><th>Expenses</th><th>Total</th><th>Terms</th><th>Locked</th></tr></thead>
        <tbody>{d.revisions.map((r:any)=><tr key={r.id}><td>R{r.revision_number}</td><td>{r.revision_date}</td><td>{money(r.professional_fee)}</td><td>{money(r.estimated_expenses)}</td><td>{money(r.estimated_total)}</td><td>{r.payment_terms}</td><td>{r.locked?"Yes":"No"}</td></tr>)}</tbody></table></div>
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
    </>
  );
}
