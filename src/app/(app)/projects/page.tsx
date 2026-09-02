import Link from "next/link";
import { Panel } from "@/components/cards";
import { getProjects } from "@/lib/data/app-data";
import { hours, money } from "@/lib/ui/format";

export default async function ProjectsPage() {
  const rows: any[] = await getProjects();
  return <>
    <div className="page-heading"><div><h1>Projects</h1><p>Select a project to manage its time, expenses, additional services, and billing.</p></div></div>
    <Panel title="Project Financial Summary">
      <div className="table-wrap"><table><thead><tr><th>Project</th><th>Name</th><th>Authorized</th><th>Hours</th><th>Expenses</th><th>Invoiced</th><th>A/R</th><th>Est. Margin*</th></tr></thead><tbody>{rows.map((project)=><tr key={project.project_id}><td><Link className="table-link" href={`/projects/${project.project_id}`}>{project.project_number}</Link></td><td><Link className="table-link" href={`/projects/${project.project_id}`}>{project.project_name}</Link></td><td>{money(project.authorized_fee)}</td><td>{hours(project.total_hours_worked)}</td><td>{money(project.actual_expenses)}</td><td>{money(project.total_invoiced)}</td><td>{money(project.outstanding_ar)}</td><td>{money(project.estimated_gross_margin_before_overhead)}</td></tr>)}</tbody></table></div>
      <p className="footnote">*Before company overhead and indirect costs.</p>
    </Panel>
  </>;
}
