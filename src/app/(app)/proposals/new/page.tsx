import { Panel } from "@/components/cards";
import { ProposalForm } from "@/components/forms/proposal-form";
import { getProposalFormData } from "@/lib/data/app-data";
import { selectDefaultProposalContact } from "@/lib/proposal-contacts";

export const dynamic = "force-dynamic";

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const { clients, defaultPaymentTerms } = await getProposalFormData();
  const inheritedClient = clients.find((client) => client.id === clientId);
  const initialClientId = inheritedClient?.id ?? "";
  const initialContactId = selectDefaultProposalContact(inheritedClient?.contacts ?? [])?.id ?? "";

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>New Proposal</h1>
          <p>{inheritedClient
            ? `${inheritedClient.company_name} and its primary contact are preselected from the client record.`
            : "The proposal number is assigned automatically. Payment terms remain attached to this revision."}</p>
        </div>
      </div>
      <Panel title="Proposal Details">
        <ProposalForm
          key={initialClientId || "new-proposal"}
          clients={clients}
          defaultPaymentTerms={defaultPaymentTerms}
          initialClientId={initialClientId}
          initialContactId={initialContactId}
        />
      </Panel>
    </>
  );
}
