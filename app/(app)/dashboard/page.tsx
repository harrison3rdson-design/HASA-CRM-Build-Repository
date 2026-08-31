import {MetricCard,Panel} from "@/components/cards";
import {getDashboardData} from "@/lib/data/app-data";
import {money} from "@/lib/ui/format";
export default async function Page(){
  const d=await getDashboardData();
  return <><div className="page-heading"><div><h1>Dashboard</h1><p>Operational and financial overview.</p></div></div>
  <div className="metric-grid">
    <MetricCard label="Open Proposals" value={d.openProposals}/>
    <MetricCard label="Active Projects" value={d.activeProjects}/>
    <MetricCard label="Outstanding A/R" value={money(d.outstandingAR)}/>
    <MetricCard label="Past Due" value={money(d.pastDue)}/>
    <MetricCard label="Unassigned Receipts" value={d.unassignedReceipts}/>
  </div>
  <Panel title="Workflow"><p className="muted">Client → Proposal → Mobile Acceptance → Project → Time/Expenses → Invoice → Payment</p></Panel></>;
}
