"use client";
import { useState } from "react";
import {
  SERVICE_PLANS,
  SERVICE_CONDITIONS,
  monthlyTotal,
  type ServiceTerms,
} from "@/lib/services/terms";
import { money } from "@/lib/ui/format";

export function ServiceTermsFields({
  initial = null,
}: {
  initial?: ServiceTerms | null;
}) {
  const [enabled, setEnabled] = useState(Boolean(initial));
  const [terms, setTerms] = useState<ServiceTerms>(
    initial ?? {
      ...SERVICE_PLANS[0],
      termMonths: 12,
      refreshMonthlyFee: 0,
      scope: "",
      refreshScope: "",
    },
  );
  const update = (patch: Partial<ServiceTerms>) =>
    setTerms((t) => ({ ...t, ...patch }));
  return (
    <section className="full line-items-section">
      <h2>Recurring Property Services</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Include a recurring service agreement
      </label>
      <input
        type="hidden"
        name="service_terms"
        value={enabled ? JSON.stringify(terms) : ""}
      />
      {enabled && (
        <>
          <p>
            One-time capture belongs in Services and Labor above. Recurring fees
            are shown separately and require customer acceptance. These are
            editable launch-price presets.
          </p>
          <label>
            Start from a package
            <select
              defaultValue=""
              onChange={(e) => {
                const plan = SERVICE_PLANS.find(
                  (p) => p.name === e.target.value,
                );
                if (plan) update(plan);
              }}
            >
              <option value="" disabled>
                Select a package
              </option>
              {SERVICE_PLANS.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Agreement name
              <input
                required
                maxLength={150}
                value={terms.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </label>
            <label>
              Monthly service fee ($)
              <input
                required
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                value={terms.monthlyFee}
                onChange={(e) => update({ monthlyFee: Number(e.target.value) })}
              />
            </label>
            <label>
              Term (months)
              <input
                required
                type="number"
                min="1"
                max="60"
                value={terms.termMonths}
                onChange={(e) => update({ termMonths: Number(e.target.value) })}
              />
            </label>
            <label>
              Included model capacity
              <input
                required
                type="number"
                min="1"
                max="10000"
                value={terms.modelAllowance}
                onChange={(e) =>
                  update({ modelAllowance: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Remote maintenance (minutes/month)
              <input
                required
                type="number"
                min="0"
                max="100000"
                value={terms.maintenanceMinutes}
                onChange={(e) =>
                  update({ maintenanceMinutes: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Monthly refresh addition ($)
              <input
                required
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                value={terms.refreshMonthlyFee}
                onChange={(e) =>
                  update({ refreshMonthlyFee: Number(e.target.value) })
                }
              />
            </label>
            <label className="full">
              Covered properties and service scope
              <textarea
                required
                maxLength={10000}
                rows={5}
                value={terms.scope}
                onChange={(e) => update({ scope: e.target.value })}
                placeholder="Identify covered properties/buildings, access checks, reviews, model allowances, transfer and retention arrangements."
              />
            </label>
            <label className="full">
              Scheduled refresh scope
              <textarea
                required={terms.refreshMonthlyFee > 0}
                maxLength={5000}
                rows={3}
                value={terms.refreshScope}
                onChange={(e) => update({ refreshScope: e.target.value })}
                placeholder="Properties, areas, visits per term, travel allowance and version retention."
              />
            </label>
          </div>
          <strong>
            {money(monthlyTotal(terms))}/month ·{" "}
            {money(monthlyTotal(terms) * terms.termMonths)} over{" "}
            {terms.termMonths} months, plus the one-time proposal charges.
          </strong>
          <p className="footnote">{SERVICE_CONDITIONS}</p>
        </>
      )}
    </section>
  );
}
