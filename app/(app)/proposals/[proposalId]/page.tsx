import { Panel } from "@/components/cards";
import { ProposalSummary } from "@/components/proposals/proposal-summary";
import { CreateRevisionButton } from "@/components/proposals/revision-button";
import { getProposalDetail } from "@/lib/data/detail-data";
import { money } from "@/lib/ui/format";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ proposalId: string }>;
}) {
  const { proposalId } = await params;
  const d = await getProposalDetail(proposalId);
  const latest = d.revisions[0];

  return (
    <>
      <div className="page-heading">
        <div><h1>Proposal {d.proposal.proposal_number}</h1><p>{d.proposal.project_name}</p></div>
        <CreateRevisionButton proposalId={proposalId} />
      </div>

      {latest ? <ProposalSummary revision={latest} /> : null}

      <Panel title="Revision History">
        <div className="table-wrap"><table><thead><tr><th>Revision</th><th>Date</th><th>Fee</th><th>Expenses</th><th>Total</th><th>Locked</th></tr></thead>
        <tbody>{d.revisions.map((r:any)=><tr key={r.id}><td>R{r.revision_number}</td><td>{r.revision_date}</td><td>{money(r.professional_fee)}</td><td>{money(r.estimated_expenses)}</td><td>{money(r.estimated_total)}</td><td>{r.locked?"Yes":"No"}</td></tr>)}</tbody></table></div>
      </Panel>

      {latest ? <>
        <Panel title="Scope">
          {d.sections.filter((s:any)=>s.proposal_revision_id===latest.id).map((s:any)=><div key={s.id} className="scope-block"><h3>{s.heading??s.section_type}</h3><p className="preline">{s.content}</p></div>)}
        </Panel>

        <Panel title="Professional Fees">
          <div className="table-wrap"><table><thead><tr><th>Description</th><th>Type</th><th>Amount</th></tr></thead>
          <tbody>{d.fees.filter((f:any)=>f.proposal_revision_id===latest.id).map((f:any)=><tr key={f.id}><td>{f.description}</td><td>{f.billing_type}</td><td>{money(f.amount)}</td></tr>)}</tbody></table></div>
        </Panel>

        <Panel title="Estimated Expenses">
          <div className="table-wrap"><table><thead><tr><th>Category</th><th>Description</th><th>Rule</th><th>Estimate</th></tr></thead>
          <tbody>{d.expenses.filter((e:any)=>e.proposal_revision_id===latest.id).map((e:any)=><tr key={e.id}><td>{e.category}</td><td>{e.description??"—"}</td><td>{e.billing_rule}</td><td>{money(e.estimated_amount)}</td></tr>)}</tbody></table></div>
        </Panel>
      </> : null}
    </>
  );
}
