"use client";

import Link from "next/link";
import { updateProposalRevisionAction } from "@/app/actions/proposals";
import {
  ProposalLineItemsFields,
  type ExpenseLineValue,
  type LaborLineValue,
  type MaterialLineValue,
} from "@/components/forms/proposal-line-items-fields";
import {
  ProposalScopeFields,
  type ScopeSectionValue,
} from "@/components/forms/proposal-scope-fields";
import { PAYMENT_TERMS, type PaymentTerms } from "@/lib/payment-terms";
import { proposalRevisionLabel } from "@/lib/proposal-revisions";

export function ProposalRevisionForm({
  proposalId,
  revision,
  scopeSections,
  laborLines,
  expenseLines,
  materialLines,
}: {
  proposalId: string;
  revision: {
    id: string;
    revision_number: number;
    payment_terms: PaymentTerms;
    proposal_terms: string;
    validity_days: number;
    billing_method: string | null;
  };
  scopeSections: ScopeSectionValue[];
  laborLines: LaborLineValue[];
  expenseLines: ExpenseLineValue[];
  materialLines: MaterialLineValue[];
}) {
  const revisionLabel = proposalRevisionLabel(revision.revision_number);

  return (
    <form action={updateProposalRevisionAction} className="form-grid">
      <input type="hidden" name="revision_id" value={revision.id} />
      <label>
        Proposal Version
        <input value={revisionLabel} readOnly />
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
          <option value="unit_priced">Unit-priced / mixed services</option>
        </select>
        <span>Choose Unit-priced / mixed when actual completed quantities determine the final service fee.</span>
      </label>

      <ProposalScopeFields initialSections={scopeSections} />

      <ProposalLineItemsFields
        initialLaborLines={laborLines}
        initialExpenseLines={expenseLines}
        initialMaterialLines={materialLines}
      />

      <label className="full">
        Proposal Terms and Conditions
        <textarea name="proposal_terms" rows={30} defaultValue={revision.proposal_terms} required />
        <span>These terms appear as the final section of the customer proposal and become permanent when this version is sent.</span>
      </label>

      <div className="full button-row">
        <button className="primary-button" type="submit">Save {revisionLabel}</button>
        <Link className="secondary-button" href={`/proposals/${proposalId}?edit=0`}>Cancel</Link>
      </div>
    </form>
  );
}
