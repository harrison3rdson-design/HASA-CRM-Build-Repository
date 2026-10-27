import {MetricCard,Panel} from "@/components/cards";
import {getDashboardData} from "@/lib/data/app-data";
import Link from "next/link";
import {serviceData} from "@/lib/services/data";
import {monthlyTotal,todayInNewYork} from "@/lib/services/terms";
import {money} from "@/lib/ui/format";
export default async function Page(){
  const [d,services]=await Promise.all([getDashboardData(),serviceData()]);
  const today=todayInNewYork();
  const active=services.agreements.filter(a=>a.status==="active"&&a.starts_on<=today&&a.ends_on>today);
  const mrr=active.reduce((sum,a)=>sum+monthlyTotal(a.terms),0);
  return <><div className="page-heading"><div><h1>Dashboard</h1><p>Operational and financial overview.</p></div></div>
  <div className="metric-grid">
    <MetricCard label="Monthly Recurring Revenue" value={money(mrr)}/>
    <MetricCard label="Active Service Agreements" value={active.length}/>
    <MetricCard label="Open Proposals" value={d.openProposals}/>
    <MetricCard label="Active Projects" value={d.activeProjects}/>
    <MetricCard label="Outstanding A/R" value={money(d.outstandingAR)}/>
    <MetricCard label="Past Due" value={money(d.pastDue)}/>
    <MetricCard label="Unassigned Receipts" value={d.unassignedReceipts}/>
  </div>
  <Panel title="Recurring Services"><Link href="/services">Review renewals, maintenance usage and refresh visits</Link></Panel>
  <Panel title="Workflow"><p className="muted">Client → Proposal → Mobile Acceptance → Project → Time/Expenses → Invoice → Payment</p></Panel></>;
}
