"use client";

import Link from "next/link";
import { updateProposalRevisionAction } from "@/app/actions/proposals";
import {
  ProposalLineItemsFields,
  type ExpenseLineValue,
  type LaborLineValue,
} from "@/components/forms/proposal-line-items-fields";
import {
  ProposalScopeFields,
  type ScopeSectionValue,
} from "@/components/forms/proposal-scope-fields";
import { PAYMENT_TERMS, type PaymentTerms } from "@/lib/payment-terms";

export function ProposalRevisionForm({
  proposalId,
  revision,
  scopeSections,
  laborLines,
  expenseLines,
}: {
  proposalId: string;
  revision: {
    id: string;
    revision_number: number;
    payment_terms: PaymentTerms;
    validity_days: number;
    billing_method: string | null;
  };
  scopeSections: ScopeSectionValue[];
  laborLines: LaborLineValue[];
  expenseLines: ExpenseLineValue[];
}) {
  return (
    <form action={updateProposalRevisionAction} className="form-grid">
      <input type="hidden" name="revision_id" value={revision.id} />
      <label>
        Revision
        <input value={`R${revision.revision_number}`} readOnly />
      </label>
      <label>
        Payment Terms
        <select name="payment_terms" defaultValue={revision.payment_terms} required>
          {PAYMENT_TERMS.map((terms) => <option key={terms} value={terms}>{terms}</option>)}
        </select>
      </label>
      <label>
        Validity (Days)
        <input name="validity_days" type="number" min="1" defaultValue={revision.validity_days} required />
      </label>
      <label>
        Billing Method
        <select name="billing_method" defaultValue={revision.billing_method ?? "fixed_fee"}>
          <option value="fixed_fee">Fixed fee</option>
          <option value="hourly">Hourly</option>
          <option value="milestone">Milestone</option>
          <option value="time_and_materials">Time and materials</option>
        </select>
      </label>

      <ProposalScopeFields initialSections={scopeSections} />

      <ProposalLineItemsFields
        initialLaborLines={laborLines}
        initialExpenseLines={expenseLines}
      />

      <div className="full button-row">
        <button className="primary-button" type="submit">Save Revision</button>
        <Link className="secondary-button" href={`/proposals/${proposalId}?edit=0`}>Cancel</Link>
      </div>
    </form>
  );
}
