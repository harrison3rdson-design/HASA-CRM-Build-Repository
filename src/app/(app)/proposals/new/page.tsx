import { Panel } from "@/components/cards";
import { ProposalForm } from "@/components/forms/proposal-form";
import { getProposalFormData } from "@/lib/data/app-data";

export const dynamic = "force-dynamic";

export default async function NewProposalPage() {
  const { clients, defaultPaymentTerms } = await getProposalFormData();

  return (
    <>
      <div className="page-heading">
        <div><h1>New Proposal</h1><p>The proposal number is assigned automatically. Payment terms remain attached to this revision.</p></div>
      </div>
      <Panel title="Proposal Details">
        <ProposalForm clients={clients} defaultPaymentTerms={defaultPaymentTerms} />
      </Panel>
    </>
  );
}
