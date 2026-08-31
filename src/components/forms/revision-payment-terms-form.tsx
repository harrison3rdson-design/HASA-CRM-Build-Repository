import { updateProposalRevisionPaymentTermsAction } from "@/app/actions/proposals";
import { PAYMENT_TERMS, type PaymentTerms } from "@/lib/payment-terms";

export function RevisionPaymentTermsForm({
  revisionId,
  paymentTerms,
  locked,
}: {
  revisionId: string;
  paymentTerms: PaymentTerms;
  locked: boolean;
}) {
  return (
    <form action={updateProposalRevisionPaymentTermsAction} className="form-grid">
      <input type="hidden" name="revision_id" value={revisionId} />
      <label>
        Payment Terms
        <select name="payment_terms" defaultValue={paymentTerms} disabled={locked} required>
          {PAYMENT_TERMS.map((terms) => <option key={terms} value={terms}>{terms}</option>)}
        </select>
      </label>
      <div className="full">
        <button className="primary-button" type="submit" disabled={locked}>
          {locked ? "Terms Locked" : "Save Payment Terms"}
        </button>
      </div>
    </form>
  );
}
