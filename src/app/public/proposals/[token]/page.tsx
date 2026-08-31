import { getPublicProposalByToken } from "@/lib/public/proposal";
import { money } from "@/lib/ui/format";
import { AcceptanceCard } from "@/components/public/acceptance-card";
import "@/styles/public.css";

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPublicProposalByToken(token);
  const { revision, proposal, sections, fees, expenses, company } = data;

  return (
    <main className="public-shell">
      <header className="public-header">
        <div className="public-brand">
          <strong>{company.display_name}</strong>
          <span>{company.legal_name}</span>
        </div>
        <div className="public-meta">Proposal #{proposal.proposal_number} · Revision {revision.revision_number}</div>
      </header>

      <section className="public-document">
        <h1>{proposal.project_name}</h1>
        <p className="public-muted">{proposal.client?.company_name}</p>
        {proposal.project_location ? <p>{proposal.project_location}</p> : null}

        {sections.map((s: any) => (
          <section key={s.id}>
            <h2>{s.heading ?? s.section_type}</h2>
            <p className="preline">{s.content}</p>
          </section>
        ))}

        <section>
          <h2>Professional Fees</h2>
          <div className="public-table">
            {fees.map((f: any) => (
              <div key={f.id}>
                <span>{f.description}<small>{Number(f.quantity)} hours × {money(f.rate)}</small></span>
                <strong>{money(f.amount)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>Estimated Expenses</h2>
          <div className="public-table">
            {expenses.map((e: any) => (
              <div key={e.id}>
                <span>
                  {e.category}{e.description ? ` — ${e.description}` : ""}
                  <small>{Number(e.estimated_quantity)} {e.unit ?? "unit(s)"} × {money(e.estimated_rate)}{Number(e.markup_percent) ? ` + ${Number(e.markup_percent)}%` : ""}</small>
                </span>
                <strong>{money(e.estimated_amount)}</strong>
              </div>
            ))}
          </div>
        </section>

        <div className="public-totals">
          <div><span>Professional Fee</span><strong>{money(revision.professional_fee)}</strong></div>
          <div><span>Estimated Expenses</span><strong>{money(revision.estimated_expenses)}</strong></div>
          <div><span>Estimated Total</span><strong>{money(revision.estimated_total)}</strong></div>
        </div>

        <p><strong>Terms:</strong> {revision.payment_terms}</p>
        <p><strong>Valid for:</strong> {revision.validity_days} days</p>
      </section>

      <AcceptanceCard
        actionUrl={`/api/public/proposals/${token}/accept`}
        buttonText="Accept Proposal"
      />
    </main>
  );
}
