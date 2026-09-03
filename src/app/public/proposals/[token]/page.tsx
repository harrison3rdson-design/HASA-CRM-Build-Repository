import { getPublicProposalByToken } from "@/lib/public/proposal";
import { AcceptanceCard } from "@/components/public/acceptance-card";
import { ProposalDocument } from "@/components/public/proposal-document";
import "@/styles/public.css";

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPublicProposalByToken(token);
  const { revision, proposal, sections, fees, expenses, materials, company } = data;

  return (
    <main className="public-shell">
      <ProposalDocument
        revision={revision}
        proposal={proposal}
        sections={sections}
        fees={fees}
        expenses={expenses}
        materials={materials}
        company={company}
      />

      <AcceptanceCard
        actionUrl={`/api/public/proposals/${token}/accept`}
        buttonText="Accept Proposal"
      />
    </main>
  );
}
