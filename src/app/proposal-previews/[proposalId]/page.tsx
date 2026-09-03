import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AcceptancePreviewCard } from "@/components/public/acceptance-preview-card";
import { ProposalDocument } from "@/components/public/proposal-document";
import { getCurrentAppUser } from "@/lib/auth/server";
import { getCompanySettings } from "@/lib/data/app-data";
import { getProposalDetail } from "@/lib/data/detail-data";
import { proposalRevisionLabel } from "@/lib/proposal-revisions";
import "@/styles/public.css";

type RevisionItem = { proposal_revision_id: string };

export default async function ProposalPreviewPage({
  params,
}: {
  params: Promise<{ proposalId: string }>;
}) {
  const { proposalId } = await params;
  const { authUser, appUser } = await getCurrentAppUser();
  if (!authUser || !appUser?.active) redirect("/login");

  const [detail, company] = await Promise.all([
    getProposalDetail(proposalId),
    getCompanySettings(),
  ]);
  const revision = detail.revisions.find(
    (candidate) => candidate.revision_number === detail.proposal.current_revision,
  ) ?? detail.revisions[0];

  if (!revision) notFound();

  const sections = detail.sections.filter(
    (section: RevisionItem) => section.proposal_revision_id === revision.id,
  );
  const fees = detail.fees.filter(
    (fee: RevisionItem) => fee.proposal_revision_id === revision.id,
  );
  const expenses = detail.expenses.filter(
    (expense: RevisionItem) => expense.proposal_revision_id === revision.id,
  );
  const materials = detail.materials.filter(
    (material: RevisionItem) => material.proposal_revision_id === revision.id,
  );

  return (
    <main className="public-shell public-preview-shell">
      <aside className="public-preview-notice" aria-label="Customer preview status">
        <div>
          <strong>Customer View Preview</strong>
          <span>This is the current {proposalRevisionLabel(revision.revision_number)} exactly as the customer will see it.</span>
        </div>
        <Link className="public-preview-back" href={`/proposals/${proposalId}`}>
          Back to Proposal Work Area
        </Link>
      </aside>

      <ProposalDocument
        revision={revision}
        proposal={detail.proposal}
        sections={sections}
        fees={fees}
        expenses={expenses}
        materials={materials}
        company={company}
      />

      <AcceptancePreviewCard />
    </main>
  );
}
