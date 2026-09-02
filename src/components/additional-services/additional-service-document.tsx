import Link from "next/link";
import { money } from "@/lib/ui/format";

type AdditionalServiceDocumentProps = {
  authorization: {
    authorization_number: string;
    description: string;
    billing_type: string;
    authorized_amount: number | string;
    labor_items?: Array<{
      id: string;
      description: string;
      hours: number | string;
      rate: number | string;
      amount: number | string;
    }>;
    expense_items?: Array<{
      id: string;
      category: string;
      description: string | null;
      estimated_quantity: number | string;
      unit: string | null;
      estimated_rate: number | string;
      estimated_amount: number | string;
    }>;
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

        {authorization.labor_items?.length ? (
          <section>
            <h2>Services and Labor</h2>
            <div className="table-wrap"><table><thead><tr><th>Description</th><th>Hours</th><th>Rate</th><th>Amount</th></tr></thead>
              <tbody>{authorization.labor_items.map((item) => <tr key={item.id}><td>{item.description}</td><td>{item.hours}</td><td>{money(item.rate)}</td><td>{money(item.amount)}</td></tr>)}</tbody>
            </table></div>
          </section>
        ) : null}

        {authorization.expense_items?.length ? (
          <section>
            <h2>Estimated Expenses</h2>
            <div className="table-wrap"><table><thead><tr><th>Category</th><th>Description</th><th>Quantity</th><th>Unit Cost</th><th>Estimate</th></tr></thead>
              <tbody>{authorization.expense_items.map((item) => <tr key={item.id}><td>{item.category}</td><td>{item.description ?? "—"}</td><td>{item.estimated_quantity} {item.unit ?? ""}</td><td>{money(item.estimated_rate)}</td><td>{money(item.estimated_amount)}</td></tr>)}</tbody>
            </table></div>
          </section>
        ) : null}

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
