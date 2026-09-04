import Link from "next/link";
import { Panel } from "@/components/cards";
import { ProjectSummary } from "@/components/projects/project-summary";
import { DeleteTimeEntryButton } from "@/components/time/delete-time-entry-button";
import { AdditionalServiceForm } from "@/components/forms/additional-service-form";
import { UnitServiceEntryForm } from "@/components/forms/unit-service-entry-form";
import { DeleteUnitServiceEntryButton } from "@/components/unit-services/delete-unit-service-entry-button";
import { getProjectDetail } from "@/lib/data/detail-data";
import { dateTime, money, hours } from "@/lib/ui/format";

function approvedSource(row: any, relationName: string, originalSourceId: string, materialSourceId?: string) {
  const relation = Array.isArray(row[relationName]) ? row[relationName][0] : row[relationName];
  const authorization = Array.isArray(relation?.additional_service)
    ? relation.additional_service[0]
    : relation?.additional_service;
  return authorization?.authorization_number
    ?? (materialSourceId && row[materialSourceId] ? "Original Proposal Materials" : row[originalSourceId] ? "Original Proposal" : "Manual");
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const d = await getProjectDetail(projectId);
  const workDate = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="page-heading">
        <div><h1>{d.project.project_number}</h1><p>{d.project.project_name}</p></div>
        <div className="button-row">
          <Link className="secondary-button" href={`/time?projectId=${projectId}#add-time`}>Add Time</Link>
          <Link className="secondary-button" href={`/expenses?projectId=${projectId}#add-expense`}>Add Expense or Material</Link>
          <Link className="primary-button" href={`/billing/new?projectId=${projectId}`}>Create Invoice</Link>
        </div>
      </div>

      <ProjectSummary financial={d.financial} />

      <div className="two-column">
        <Panel title="Project">
          <p><strong>Client:</strong> {d.project.client?.company_name}</p>
          <p><strong>Status:</strong> {d.project.status}</p>
          <p><strong>Location:</strong> {d.project.project_location ?? "—"}</p>
          <p><strong>Completion:</strong> {d.project.percent_complete}%</p>
          {d.sourceAcceptance ? <>
            <p><strong>Approved by:</strong> {d.sourceAcceptance.signer_name}{d.sourceAcceptance.signer_title ? `, ${d.sourceAcceptance.signer_title}` : ""}</p>
            <p><strong>Approval date:</strong> {dateTime(d.sourceAcceptance.accepted_at)}</p>
          </> : null}
          {d.project.source_proposal_id ? <p><Link className="table-link" href={`/proposals/${d.project.source_proposal_id}`}>Review originating proposal and approval</Link></p> : null}
        </Panel>

        <Panel title="New Additional Service">
          <AdditionalServiceForm projectId={projectId} />
        </Panel>
      </div>

      <Panel title="Recent Time">
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Approved Source</th><th>Activity</th><th>Description</th><th>Hours</th><th>Billable</th><th>Actions</th></tr></thead>
        <tbody>{d.time.map((t:any)=><tr key={t.id}><td>{t.work_date}</td><td>{approvedSource(t, "source_additional_service_labor_item", "source_fee_item_id")}</td><td>{t.activity_type}</td><td>{t.description??"—"}</td><td>{hours(t.hours)}</td><td>{t.billable?"Yes":"No"}</td><td>{!t.locked && !t.invoice_item_id ? <DeleteTimeEntryButton timeEntryId={t.id} workDate={t.work_date} entryHours={Number(t.hours)} /> : <span className="muted">Locked</span>}</td></tr>)}</tbody></table></div>
      </Panel>

      {d.unitServiceOptions.length ? <Panel title="Per-Unit Work">
        <p className="footnote">
          Record actual completed quantities for unit-priced services in the accepted proposal.
          Billable entries are available to Progress and Final invoices and cannot be billed twice.
        </p>
        <UnitServiceEntryForm
          projectId={projectId}
          services={d.unitServiceOptions}
          workDate={workDate}
        />
        {d.unitServices.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Service</th><th>Notes</th><th>Quantity</th><th>Rate</th><th>Value</th><th>Billable</th><th>Actions</th></tr></thead>
        <tbody>{d.unitServices.map((entry:any)=>{const source=Array.isArray(entry.source_fee_item)?entry.source_fee_item[0]:entry.source_fee_item;return <tr key={entry.id}><td>{entry.work_date}</td><td>{source?.description??"Approved per-unit service"}</td><td>{entry.description??"—"}</td><td>{Number(entry.quantity)} {entry.unit}</td><td>{money(entry.billing_rate)}</td><td>{money(Number(entry.quantity)*Number(entry.billing_rate))}</td><td>{entry.billable?"Yes":"No"}</td><td>{!entry.locked&&!entry.invoice_item_id?<DeleteUnitServiceEntryButton entryId={entry.id} quantity={Number(entry.quantity)} unit={entry.unit}/>:<span className="muted">Locked</span>}</td></tr>})}</tbody></table></div>
        : <p className="muted">No per-unit work has been recorded.</p>}
      </Panel> : null}

      <Panel title="Recent Expenses and Materials">
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Approved Source</th><th>Category</th><th>Vendor</th><th>Actual</th><th>Billable</th></tr></thead>
        <tbody>{d.expenses.map((e:any)=><tr key={e.id}><td>{e.expense_date}</td><td>{approvedSource(e, "source_additional_service_expense_item", "source_estimate_id", "source_material_id")}</td><td>{e.category}</td><td>{e.vendor??"—"}</td><td>{money(e.actual_cost)}</td><td>{money(e.billable_amount)}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel title="Additional Services">
        <div className="table-wrap"><table><thead><tr><th>Authorization</th><th>Description</th><th>Amount</th><th>Status</th><th>Approved By</th><th>Approval Date</th></tr></thead>
        <tbody>{d.authorizations.map((a:any)=>{const acceptance=Array.isArray(a.acceptances)?a.acceptances[0]:a.acceptances;return <tr key={a.id}><td><Link className="table-link" href={`/additional-services/${a.id}`}>{a.authorization_number}</Link></td><td>{a.description}</td><td>{money(a.authorized_amount)}</td><td>{a.status}</td><td>{acceptance?.signer_name??"—"}</td><td>{dateTime(acceptance?.accepted_at)}</td></tr>})}</tbody></table></div>
      </Panel>

      <Panel title="Invoices">
        <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Date</th><th>Type</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>{d.invoices.map((i:any)=><tr key={i.id}><td><Link className="table-link" href={`/billing/${i.id}`}>{i.invoice_number}</Link></td><td>{i.invoice_date}</td><td>{i.invoice_type}</td><td>{money(i.total)}</td><td>{money(i.balance_due)}</td><td>{i.status}</td></tr>)}</tbody></table></div>
      </Panel>
    </>
  );
}
