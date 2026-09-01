"use client";

import { createProposalAction } from "@/app/actions/proposals";
import { ProposalLineItemsFields } from "@/components/forms/proposal-line-items-fields";
import { ProposalScopeFields } from "@/components/forms/proposal-scope-fields";
import { PAYMENT_TERMS, type PaymentTerms } from "@/lib/payment-terms";

type ClientOption = {
  id: string;
  client_number: string;
  company_name: string;
};

export function ProposalForm({
  clients,
  defaultPaymentTerms,
}: {
  clients: ClientOption[];
  defaultPaymentTerms: PaymentTerms;
}) {
  return (
    <form action={createProposalAction} className="form-grid">
      <label>
        Proposal Number
        <input value="Assigned automatically when saved" readOnly aria-describedby="proposal-number-help" />
        <span id="proposal-number-help">Annual sequence: YYYY0151, YYYY0152, YYYY0153…</span>
      </label>
      <label>
        Client
        <select name="client_id" required>
          <option value="">Select client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.client_number} — {client.company_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Project Name
        <input name="project_name" required />
      </label>
      <label>
        Project Location
        <input name="project_location" />
      </label>
      <label>
        Payment Terms
        <select name="payment_terms" defaultValue={defaultPaymentTerms} required>
          {PAYMENT_TERMS.map((terms) => <option key={terms} value={terms}>{terms}</option>)}
        </select>
      </label>
      <label>
        Validity (Days)
        <input name="validity_days" type="number" min="1" defaultValue="15" required />
      </label>
      <label>
        Billing Method
        <select name="billing_method" defaultValue="fixed_fee">
          <option value="fixed_fee">Fixed fee</option>
          <option value="hourly">Hourly</option>
          <option value="milestone">Milestone</option>
          <option value="time_and_materials">Time and materials</option>
        </select>
      </label>

      <ProposalScopeFields />

      <ProposalLineItemsFields />

      <div className="full">
        <button className="primary-button" type="submit">Create Proposal</button>
      </div>
    </form>
  );
}
