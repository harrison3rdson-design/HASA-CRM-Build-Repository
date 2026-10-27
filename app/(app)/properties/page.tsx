import Link from "next/link";
import { Panel } from "@/components/cards";
import { PropertyForm } from "@/components/services/property-form";
import { serviceData } from "@/lib/services/data";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const d = await serviceData();
  const { clientId } = await searchParams;
  const properties = d.properties.filter(
    (p) => !clientId || p.client_id === clientId,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Properties</h1>
          <p>
            Property records and digital twins stay available after capture
            projects are complete.
          </p>
        </div>
        <Link className="secondary-button" href="/services">
          Service Agreements
        </Link>
      </div>
      <Panel title="Property Directory">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Property</th>
                <th>Client</th>
                <th>Type</th>
                <th>Hosted models</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/properties/${p.id}`}>{p.name}</Link>
                  </td>
                  <td>
                    {d.clients.find((c) => c.id === p.client_id)?.company_name}
                  </td>
                  <td>{p.property_type.replaceAll("_", " ")}</td>
                  <td>
                    {
                      d.models.filter((m) => m.property_id === p.id && m.hosted)
                        .length
                    }
                  </td>
                  <td>{p.active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!properties.length && (
            <p>No properties yet. Add a client’s first property below.</p>
          )}
        </div>
      </Panel>
      {d.canManage && (
        <Panel title="Add Property">
          <PropertyForm
            clients={d.clients.filter((c) => c.active)}
            clientId={clientId}
          />
        </Panel>
      )}
    </>
  );
}
