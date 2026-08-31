import { Panel } from "@/components/cards";
import { DetailGrid, DetailItem } from "@/components/dialogs/details";
import { ClientEditForm } from "@/components/forms/client-edit-form";
import { ContactForm } from "@/components/forms/contact-form";
import { getClientDetail } from "@/lib/data/detail-data";
import { money } from "@/lib/ui/format";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const d = await getClientDetail(clientId);

  return (
    <>
      <div className="page-heading">
        <div><h1>{d.client.company_name}</h1><p>Client history and relationships.</p></div>
      </div>

      <Panel title="Client Information">
        <DetailGrid>
          <DetailItem label="Billing Name" value={d.client.billing_name} />
          <DetailItem label="Email" value={d.client.email} />
          <DetailItem label="Phone" value={d.client.phone} />
          <DetailItem label="Status" value={d.client.active ? "Active" : "Inactive"} />
        </DetailGrid>
      </Panel>

      <Panel title="Edit Client Information">
        <ClientEditForm client={d.client} />
      </Panel>

      <Panel title="Contacts">
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Title</th><th>Email</th><th>Mobile</th><th>Primary</th></tr></thead>
        <tbody>{d.contacts.map((c:any)=><tr key={c.id}><td>{[c.first_name,c.last_name].filter(Boolean).join(" ")}</td><td>{c.title??"—"}</td><td>{c.email??"—"}</td><td>{c.mobile_phone??"—"}</td><td>{c.is_primary?"Yes":"No"}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel title="Add Contact">
        <ContactForm clientId={clientId} />
      </Panel>

      <Panel title="Proposals">
        <div className="table-wrap"><table><thead><tr><th>Proposal</th><th>Project</th><th>Status</th><th>Revision</th></tr></thead>
        <tbody>{d.proposals.map((p:any)=><tr key={p.id}><td><a href={`/proposals/${p.id}`}>{p.proposal_number}</a></td><td>{p.project_name}</td><td>{p.status}</td><td>R{p.current_revision}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel title="Projects">
        <div className="table-wrap"><table><thead><tr><th>Project</th><th>Name</th><th>Status</th><th>Authorized</th></tr></thead>
        <tbody>{d.projects.map((p:any)=><tr key={p.id}><td><a href={`/projects/${p.id}`}>{p.project_number}</a></td><td>{p.project_name}</td><td>{p.status}</td><td>{money(p.authorized_fee)}</td></tr>)}</tbody></table></div>
      </Panel>
    </>
  );
}
