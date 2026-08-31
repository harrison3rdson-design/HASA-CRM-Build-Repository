import Link from "next/link";
import { MetricCard, Panel } from "@/components/cards";
import { getInvoices } from "@/lib/data/app-data";
import { money } from "@/lib/ui/format";

export default async function Page() {
  const rows: any[] = await getInvoices();
  const outstanding = rows.reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);
  const paid = rows.reduce((sum, invoice) => sum + Number(invoice.amount_paid ?? 0), 0);

  return (
    <>
      <div className="page-heading">
        <div><h1>Billing</h1><p>Advance, progress, hourly, expense, and final invoicing.</p></div>
        <Link className="primary-button" href="/billing/new">Create Invoice</Link>
      </div>
      <div className="metric-grid compact">
        <MetricCard label="Outstanding" value={money(outstanding)} />
        <MetricCard label="Collected" value={money(paid)} />
        <MetricCard label="Invoices" value={rows.length} />
      </div>
      <Panel title="Invoice Register">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Client</th><th>Project</th><th>Type</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead>
            <tbody>{rows.map((invoice) => (
              <tr key={invoice.id}>
                <td><Link href={`/billing/${invoice.id}`}>{invoice.invoice_number}</Link></td>
                <td>{invoice.client?.company_name ?? "—"}</td>
                <td>{invoice.project?.project_number ?? "—"}</td>
                <td>{invoice.invoice_type}</td>
                <td>{money(invoice.total)}</td>
                <td>{money(invoice.balance_due)}</td>
                <td><span className="pill">{invoice.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
