import Link from "next/link";
import { Panel } from "@/components/cards";
import { getClients } from "@/lib/data/app-data";

export default async function Page() {
  const rows: any[] = await getClients();

  return (
    <>
      <div className="page-heading">
        <div><h1>Clients</h1><p>Client organizations and billing contacts.</p></div>
        <Link className="primary-button" href="/clients/new">New Client</Link>
      </div>
      <Panel title="Client Directory">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client #</th><th>Company</th><th>Email</th><th>Phone</th><th>Status</th></tr></thead>
            <tbody>{rows.map((client) => (
              <tr key={client.id}>
                <td><Link href={`/clients/${client.id}`}>{client.client_number}</Link></td>
                <td><Link href={`/clients/${client.id}`}>{client.company_name}</Link></td>
                <td>{client.email ?? "—"}</td>
                <td>{client.phone ?? "—"}</td>
                <td><span className="pill">{client.active ? "Active" : "Inactive"}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
