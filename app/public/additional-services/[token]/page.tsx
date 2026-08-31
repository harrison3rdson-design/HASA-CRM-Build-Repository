import { getPublicAuthorizationByToken } from "@/lib/public/additional-service";
import { money } from "@/lib/ui/format";
import { AcceptanceCard } from "@/components/public/acceptance-card";
import "@/styles/public.css";

export default async function PublicAuthorizationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { authorization, company } = await getPublicAuthorizationByToken(token);

  return (
    <main className="public-shell">
      <header className="public-header">
        <div className="public-brand">
          <strong>{company.display_name}</strong>
          <span>{company.legal_name}</span>
        </div>
        <div className="public-meta">{authorization.authorization_number}</div>
      </header>

      <section className="public-document">
        <h1>Additional Service Authorization</h1>
        <p className="public-muted">{authorization.project?.client?.company_name}</p>
        <p><strong>Project:</strong> {authorization.project?.project_number} — {authorization.project?.project_name}</p>

        <section>
          <h2>Requested Additional Service</h2>
          <p className="preline">{authorization.description}</p>
        </section>

        <div className="public-totals">
          <div><span>Billing Type</span><strong>{authorization.billing_type}</strong></div>
          <div><span>Authorized Amount</span><strong>{money(authorization.authorized_amount)}</strong></div>
        </div>
      </section>

      <AcceptanceCard
        actionUrl={`/api/public/additional-services/${token}/accept`}
        buttonText="Accept Additional Service"
      />
    </main>
  );
}
