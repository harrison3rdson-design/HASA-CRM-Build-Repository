import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@/components/cards";
import { PropertyForm, ModelForm } from "@/components/services/property-form";
import { serviceData } from "@/lib/services/data";
export default async function Page({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const d = await serviceData();
  const p = d.properties.find((p) => p.id === propertyId);
  if (!p) notFound();
  const models = d.models.filter((m) => m.property_id === p.id);
  const coverage = d.coverage.filter((c) => c.property_id === p.id);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{p.name}</h1>
          <p>
            {p.address} ·{" "}
            {p.square_feet
              ? `${Number(p.square_feet).toLocaleString()} sq. ft.`
              : "Area not recorded"}
          </p>
        </div>
        <Link className="secondary-button" href={`/clients/${p.client_id}`}>
          Client Record
        </Link>
      </div>
      <Panel title="Property Details">
        {d.canManage ? (
          <PropertyForm clients={d.clients} property={p} />
        ) : (
          <p>{p.access_notes ?? "No access notes."}</p>
        )}
      </Panel>
      <Panel title="Service Agreements">
        {coverage.length ? (
          coverage.map((c) => {
            const a = d.agreements.find((a) => a.id === c.agreement_id);
            return a ? (
              <p key={a.id}>
                <Link href={`/services/${a.id}`}>
                  {a.agreement_number} · {a.terms.name}
                </Link>{" "}
                — {a.status}
              </p>
            ) : null;
          })
        ) : (
          <p>No service agreement linked yet.</p>
        )}
      </Panel>
      <Panel title="Digital Twins">
        <p>
          Store each building or retained version separately.
          Internal/guest-facing labels are for organization; platform
          permissions control access.
        </p>
        {!models.length && <p>No models recorded yet.</p>}
        {models.map((m) => (
          <details key={m.id} style={{ marginBottom: 20 }}>
            <summary>
              <a href={m.model_url} target="_blank" rel="noreferrer">
                {m.name}
              </a>{" "}
              · {m.captured_on} · {m.visibility.replaceAll("_", " ")} ·{" "}
              {m.hosted ? `${m.capacity_units} capacity units` : "Not hosted"}
            </summary>
            {d.canManage && <ModelForm propertyId={p.id} model={m} />}
          </details>
        ))}
      </Panel>
      {d.canManage && (
        <Panel title="Add Digital Twin">
          <ModelForm propertyId={p.id} />
        </Panel>
      )}
    </>
  );
}
