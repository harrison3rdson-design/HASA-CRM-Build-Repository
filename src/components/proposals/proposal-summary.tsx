import { money } from "@/lib/ui/format";

export function ProposalSummary({ revision }: { revision: any }) {
  return (
    <div className="summary-grid">
      <div><span>Professional Fee</span><strong>{money(revision.professional_fee)}</strong></div>
      <div><span>Estimated Materials</span><strong>{money(revision.estimated_materials)}</strong></div>
      <div><span>Estimated Expenses</span><strong>{money(revision.estimated_expenses)}</strong></div>
      <div><span>Estimated Total</span><strong>{money(revision.estimated_total)}</strong></div>
      <div><span>Terms</span><strong>{revision.payment_terms}</strong></div>
    </div>
  );
}
