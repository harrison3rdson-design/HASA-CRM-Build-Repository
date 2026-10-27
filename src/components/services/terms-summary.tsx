import {
  SERVICE_CONDITIONS,
  monthlyTotal,
  type ServiceTerms,
} from "@/lib/services/terms";
import { money } from "@/lib/ui/format";
export function ServiceTermsSummary({
  terms,
}: {
  terms: ServiceTerms | null | undefined;
}) {
  if (!terms) return null;
  return (
    <section className="proposal-summary-area">
      <h2>Recurring Services — {terms.name}</h2>
      <p>
        <strong>
          {money(monthlyTotal(terms))}/month for {terms.termMonths} months
        </strong>{" "}
        · Total recurring commitment:{" "}
        {money(monthlyTotal(terms) * terms.termMonths)}. This is additional to
        the one-time proposal total.
      </p>
      <p>
        Service: {money(terms.monthlyFee)}/month · Refresh:{" "}
        {money(terms.refreshMonthlyFee)}/month · Model capacity:{" "}
        {terms.modelAllowance} · Remote maintenance: {terms.maintenanceMinutes}{" "}
        minutes/month.
      </p>
      <p style={{ whiteSpace: "pre-wrap" }}>{terms.scope}</p>
      {terms.refreshScope && (
        <p style={{ whiteSpace: "pre-wrap" }}>
          <strong>Refresh scope: </strong>
          {terms.refreshScope}
        </p>
      )}
      <p>{terms.conditions ?? SERVICE_CONDITIONS}</p>
    </section>
  );
}
