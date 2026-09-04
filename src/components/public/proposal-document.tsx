import Link from "next/link";
import Image from "next/image";
import { money } from "@/lib/ui/format";
import { proposalRevisionLabel } from "@/lib/proposal-revisions";
import { resolveDefaultProposalTerms } from "@/lib/proposal-terms";

type ProposalDocumentProps = {
  revision: {
    revision_number: number | string;
    professional_fee: number | string | null;
    estimated_expenses: number | string | null;
    estimated_materials: number | string | null;
    estimated_total: number | string | null;
    payment_terms: string;
    validity_days: number | string;
    proposal_terms?: string | null;
    locked: boolean;
  };
  proposal: {
    proposal_number: string;
    project_name: string;
    project_location?: string | null;
    client?: { company_name?: string | null } | null;
  };
  sections: Array<{
    id: string;
    heading?: string | null;
    section_type: string;
    content: string;
  }>;
  fees: Array<{
    id: string;
    description: string;
    billing_type: string;
    quantity: number | string | null;
    unit: string;
    rate: number | string | null;
    amount: number | string | null;
  }>;
  expenses: Array<{
    id: string;
    category: string;
    description?: string | null;
    estimated_quantity: number | string | null;
    unit?: string | null;
    estimated_rate: number | string | null;
    markup_percent: number | string | null;
    estimated_amount: number | string | null;
  }>;
  materials: Array<{
    id: string;
    description: string;
    quantity: number | string | null;
    unit: string;
    unit_price: number | string | null;
    amount: number | string | null;
  }>;
  company: {
    display_name: string;
    legal_name: string;
    default_proposal_terms?: string | null;
  };
};

function quantityLabel(value: number | string | null, unit: string) {
  const quantity = Number(value ?? 0);
  const label = quantity === 1 ? unit : `${unit}s`;
  return `${quantity} ${label}`;
}

function servicePriceDetail(fee: ProposalDocumentProps["fees"][number]) {
  if (fee.billing_type === "included") return "Included in professional fee";
  if (fee.billing_type === "fixed") return `Fixed fee · ${money(fee.rate)}`;
  const basis = fee.billing_type === "hourly" ? "Hourly" : "Per unit";
  return `${basis} · ${Number(fee.quantity ?? 0)} ${fee.unit} × ${money(fee.rate)}`;
}

export function ProposalDocument({
  revision,
  proposal,
  sections,
  fees,
  expenses,
  materials,
  company,
}: ProposalDocumentProps) {
  const proposalTerms = revision.proposal_terms
    ?? (revision.locked ? "" : resolveDefaultProposalTerms(company.default_proposal_terms));
  const showMaterialsSummary = materials.length > 0 || Number(revision.estimated_materials ?? 0) !== 0;

  return (
    <>
      <header className="public-header">
        <div className="public-brand">
          <Image
            className="public-brand-logo"
            src="/branding/hasa-logo-horizontal.jpeg"
            alt="HASA Concepts"
            width={240}
            height={111}
            priority
          />
          <span>{company.legal_name}</span>
        </div>
        <div className="public-meta">
          Proposal #{proposal.proposal_number} · {proposalRevisionLabel(revision.revision_number)}
        </div>
      </header>

      <article className="public-document">
        <h1>{proposal.project_name}</h1>
        <p className="public-muted">{proposal.client?.company_name}</p>
        {proposal.project_location ? <p>{proposal.project_location}</p> : null}

        <section className="proposal-details-area" aria-labelledby="proposal-details-heading">
          <div className="proposal-section-heading">
            <span>Proposal Details</span>
            <h2 id="proposal-details-heading">Scope and Pricing Details</h2>
            <p>The proposed work and itemized pricing are shown below.</p>
          </div>

          {sections.map((section) => (
            <section key={section.id}>
              <h2>{section.heading ?? section.section_type}</h2>
              <p className="preline">{section.content}</p>
            </section>
          ))}

          <section>
            <h2>Professional Fees</h2>
            <div className="public-table">
              {fees.map((fee) => (
                <div key={fee.id}>
                  <span>
                    {fee.description}
                    <small>{servicePriceDetail(fee)}</small>
                  </span>
                  <strong>{money(fee.amount)}</strong>
                </div>
              ))}
            </div>
          </section>

          {materials.length ? <section>
            <h2>Materials</h2>
            <div className="public-table">
              {materials.map((material) => (
                <div key={material.id}>
                  <span>
                    {material.description}
                    <small>{quantityLabel(material.quantity, material.unit)} × {money(material.unit_price)}</small>
                  </span>
                  <strong>{money(material.amount)}</strong>
                </div>
              ))}
            </div>
          </section> : null}

          <section>
            <h2>Estimated Expenses</h2>
            <div className="public-table">
              {expenses.map((expense) => (
                <div key={expense.id}>
                  <span>
                    {expense.category}{expense.description ? ` — ${expense.description}` : ""}
                    <small>
                      {quantityLabel(expense.estimated_quantity, expense.unit ?? "unit")} × {money(expense.estimated_rate)}
                      {Number(expense.markup_percent) ? ` + ${Number(expense.markup_percent)}%` : ""}
                    </small>
                  </span>
                  <strong>{money(expense.estimated_amount)}</strong>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="proposal-summary-area" aria-labelledby="proposal-summary-heading">
          <div className="proposal-section-heading">
            <span>Proposal Summary</span>
            <h2 id="proposal-summary-heading">Investment and Commercial Terms</h2>
            <p>This summary identifies the proposed total, payment terms, and validity period.</p>
          </div>
          <div className="public-totals">
            <div><span>Professional Fee</span><strong>{money(revision.professional_fee)}</strong></div>
            {showMaterialsSummary ? (
              <div><span>Estimated Materials</span><strong>{money(revision.estimated_materials)}</strong></div>
            ) : null}
            <div><span>Estimated Expenses</span><strong>{money(revision.estimated_expenses)}</strong></div>
            <div><span>Estimated Total</span><strong>{money(revision.estimated_total)}</strong></div>
          </div>
          <div className="proposal-commercial-terms">
            <p><strong>Payment Terms:</strong> {revision.payment_terms}</p>
            <p><strong>Proposal Validity:</strong> {revision.validity_days} days</p>
          </div>
        </section>

        <nav className="public-legal-links" aria-label="Legal information">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms and Conditions</Link>
        </nav>
      </article>
      {proposalTerms ? (
        <article className="public-document proposal-terms-page">
          <h1>Proposal Terms and Conditions</h1>
          <p className="public-muted">
            Incorporated into Proposal #{proposal.proposal_number} · {proposalRevisionLabel(revision.revision_number)}
          </p>
          <div className="proposal-terms-text">{proposalTerms}</div>
        </article>
      ) : null}
    </>
  );
}
