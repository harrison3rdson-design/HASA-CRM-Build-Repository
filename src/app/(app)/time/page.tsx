import Link from "next/link";
import { Panel } from "@/components/cards";
import { ManualTimeForm } from "@/components/forms/manual-time-form";
import { getProjectWorkOptions, getTimeEntries } from "@/lib/data/app-data";
import { hours, money } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

function sourceLabel(entry: any) {
  const item = Array.isArray(entry.source_additional_service_labor_item)
    ? entry.source_additional_service_labor_item[0]
    : entry.source_additional_service_labor_item;
  const authorization = Array.isArray(item?.additional_service)
    ? item.additional_service[0]
    : item?.additional_service;
  return authorization?.authorization_number ?? (entry.source_fee_item_id ? "Original Proposal" : "Manual");
}

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const [rows, projects] = await Promise.all([getTimeEntries(), getProjectWorkOptions()]);
  const workDate = new Date().toISOString().slice(0, 10);
  const returnTo = projectId ? `/projects/${projectId}` : undefined;

  return <>
    <div className="page-heading">
      <div><h1>Time</h1><p>Record project time without re-entering project information.</p></div>
      <Link className="primary-button" href="#add-time">Add Time</Link>
    </div>
    <div id="add-time">
      <Panel title={projectId ? "Add Time to Project" : "Manual Time Entry"}>
        <ManualTimeForm projects={projects} selectedProjectId={projectId} workDate={workDate} returnTo={returnTo} />
      </Panel>
    </div>
    <Panel title="Recent Time">
      <div className="table-wrap"><table><thead><tr><th>Date</th><th>Project</th><th>Approved Source</th><th>Activity</th><th>Description</th><th>Hours</th><th>Value</th></tr></thead><tbody>{rows.map((x:any)=><tr key={x.id}><td>{x.work_date}</td><td>{x.project?.project_number??"—"}</td><td>{sourceLabel(x)}</td><td>{x.is_travel_time?"Travel Time":x.activity_type}</td><td>{x.description??"—"}</td><td>{hours(x.hours)}</td><td>{money(Number(x.hours)*Number(x.billing_rate))}</td></tr>)}</tbody></table></div>
    </Panel>
  </>;
}
