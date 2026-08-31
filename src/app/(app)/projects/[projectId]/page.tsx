import { Panel } from "@/components/cards";
import { ProjectSummary } from "@/components/projects/project-summary";
import { AdditionalServiceForm } from "@/components/forms/additional-service-form";
import { getProjectDetail } from "@/lib/data/detail-data";
import { money, hours } from "@/lib/ui/format";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const d = await getProjectDetail(projectId);

  return (
    <>
      <div className="page-heading">
        <div><h1>{d.project.project_number}</h1><p>{d.project.project_name}</p></div>
      </div>

      <ProjectSummary financial={d.financial} />

      <div className="two-column">
        <Panel title="Project">
          <p><strong>Client:</strong> {d.project.client?.company_name}</p>
          <p><strong>Status:</strong> {d.project.status}</p>
          <p><strong>Location:</strong> {d.project.project_location ?? "—"}</p>
          <p><strong>Completion:</strong> {d.project.percent_complete}%</p>
        </Panel>

        <Panel title="New Additional Service">
          <AdditionalServiceForm projectId={projectId} />
        </Panel>
      </div>

      <Panel title="Recent Time">
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Activity</th><th>Description</th><th>Hours</th><th>Billable</th></tr></thead>
        <tbody>{d.time.map((t:any)=><tr key={t.id}><td>{t.work_date}</td><td>{t.activity_type}</td><td>{t.description??"—"}</td><td>{hours(t.hours)}</td><td>{t.billable?"Yes":"No"}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel title="Recent Expenses">
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Actual</th><th>Billable</th></tr></thead>
        <tbody>{d.expenses.map((e:any)=><tr key={e.id}><td>{e.expense_date}</td><td>{e.category}</td><td>{e.vendor??"—"}</td><td>{money(e.actual_cost)}</td><td>{money(e.billable_amount)}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel title="Additional Services">
        <div className="table-wrap"><table><thead><tr><th>Authorization</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>{d.authorizations.map((a:any)=><tr key={a.id}><td>{a.authorization_number}</td><td>{a.description}</td><td>{money(a.authorized_amount)}</td><td>{a.status}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel title="Invoices">
        <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Date</th><th>Type</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>{d.invoices.map((i:any)=><tr key={i.id}><td><a href={`/billing/${i.id}`}>{i.invoice_number}</a></td><td>{i.invoice_date}</td><td>{i.invoice_type}</td><td>{money(i.total)}</td><td>{money(i.balance_due)}</td><td>{i.status}</td></tr>)}</tbody></table></div>
      </Panel>
    </>
  );
}
