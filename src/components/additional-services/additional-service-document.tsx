import Link from "next/link";
import { money } from "@/lib/ui/format";

type AdditionalServiceDocumentProps = {
  authorization: {
    authorization_number: string;
    description: string;
    billing_type: string;
    authorized_amount: number | string;
    project?: {
      project_number?: string | null;
      project_name?: string | null;
      project_location?: string | null;
      client?: { company_name?: string | null } | null;
    } | null;
  };
  company: {
    display_name: string;
    legal_name: string;
  };
};

function billingTypeLabel(value: string) {
  return value.split("_").map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(" ");
}

export function AdditionalServiceDocument({ authorization, company }: AdditionalServiceDocumentProps) {
  return (
    <>
      <header className="public-header">
        <div className="public-brand">
          <strong>{company.display_name}</strong>
          <span>{company.legal_name}</span>
        </div>
        <div className="public-meta">Authorization #{authorization.authorization_number}</div>
      </header>

      <article className="public-document">
        <h1>Additional Service Authorization</h1>
        <p className="public-muted">{authorization.project?.client?.company_name}</p>
        <p>
          <strong>Project:</strong> {authorization.project?.project_number} — {authorization.project?.project_name}
        </p>
        {authorization.project?.project_location ? <p>{authorization.project.project_location}</p> : null}

        <section>
          <h2>Requested Additional Service</h2>
          <p className="preline">{authorization.description}</p>
        </section>

        <div className="public-totals">
          <div><span>Billing Type</span><strong>{billingTypeLabel(authorization.billing_type)}</strong></div>
          <div><span>Authorized Amount</span><strong>{money(authorization.authorized_amount)}</strong></div>
        </div>

        <nav className="public-legal-links" aria-label="Legal information">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms and Conditions</Link>
        </nav>
      </article>
    </>
  );
}
