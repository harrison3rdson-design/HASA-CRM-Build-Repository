import Link from "next/link";
import { Panel, MetricCard } from "@/components/cards";
import { serviceData } from "@/lib/services/data";
import {
  monthlyTotal,
  todayInNewYork,
  calendarMonthMinutes,
} from "@/lib/services/terms";
import { money } from "@/lib/ui/format";
export default async function Page() {
  const d = await serviceData();
  const today = todayInNewYork();
  const active = d.agreements.filter(
    (a) => a.status === "active" && a.starts_on <= today && a.ends_on > today,
  );
  const mrr = active.reduce((sum, a) => sum + monthlyTotal(a.terms), 0);
  const next30 = new Date(`${today}T00:00:00Z`);
  next30.setUTCDate(next30.getUTCDate() + 30);
  const upcoming = next30.toISOString().slice(0, 10);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Service Agreements</h1>
          <p>
            Recurring property services, maintenance allowances, renewal reviews
            and scheduled refreshes.
          </p>
        </div>
        <Link className="primary-button" href="/proposals/new">
          New Service Proposal
        </Link>
      </div>
      <div className="metric-grid">
        <MetricCard label="Monthly Recurring Revenue" value={money(mrr)} />
        <MetricCard
          label="Annualized Recurring Revenue"
          value={money(mrr * 12)}
        />
        <MetricCard label="Active Agreements" value={active.length} />
        <MetricCard
          label="Terms Ending in 30 Days"
          value={
            d.agreements.filter(
              (a) =>
                a.status === "active" &&
                a.ends_on >= today &&
                a.ends_on <= upcoming,
            ).length
          }
        />
      </div>
      <Panel title="Agreements">
        <p>
          Include recurring terms in a proposal, obtain acceptance, then choose
          “Set Up Recurring Agreement” on the proposal. Agreements do not renew
          automatically.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agreement</th>
                <th>Client</th>
                <th>Monthly fee</th>
                <th>Status</th>
                <th>Term ends (exclusive)</th>
                <th>Maintenance this month</th>
              </tr>
            </thead>
            <tbody>
              {d.agreements.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/services/${a.id}`}>
                      {a.agreement_number} · {a.terms.name}
                    </Link>
                  </td>
                  <td>
                    {d.clients.find((c) => c.id === a.client_id)?.company_name}
                  </td>
                  <td>{money(monthlyTotal(a.terms))}</td>
                  <td>
                    {a.status}
                    {a.status === "active" && a.starts_on > today
                      ? " (scheduled)"
                      : ""}
                  </td>
                  <td>{a.ends_on ?? "Not activated"}</td>
                  <td>
                    {calendarMonthMinutes(
                      d.work.filter((w) => w.agreement_id === a.id),
                      today,
                    )}{" "}
                    / {a.terms.maintenanceMinutes} min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.agreements.length && <p>No agreements yet.</p>}
        </div>
      </Panel>
      <Panel title="Refresh Visits Due / Upcoming (30 Days)">
        {d.refreshes
          .filter((t) => t.status === "planned" && t.due_on <= upcoming)
          .map((t) => (
            <p key={t.id}>
              <Link href={`/services/${t.agreement_id}`}>
                {t.due_on} — {t.scope}
              </Link>
              {t.due_on < today ? " · Overdue" : ""}
            </p>
          ))}
        {!d.refreshes.some(
          (t) => t.status === "planned" && t.due_on <= upcoming,
        ) && <p>No refresh visits due.</p>}
      </Panel>
      <Panel title="Billing Workflow">
        <p>
          The daily billing run creates draft invoices for each active
          agreement’s due monthly periods. Review and send them through Billing.
          It does not send emails or charge payment methods automatically.
          Prices remain fixed for the accepted term.
        </p>
      </Panel>
    </>
  );
}
