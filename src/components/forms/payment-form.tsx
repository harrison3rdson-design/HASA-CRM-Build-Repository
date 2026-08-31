import { recordPaymentAction } from "@/app/actions/invoices";

export function PaymentForm({ invoiceId }: { invoiceId: string }) {
  return (
    <form action={recordPaymentAction} className="form-grid">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <label>Payment Date<input name="payment_date" type="date" required /></label>
      <label>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label>
      <label>Method
        <select name="payment_method" defaultValue="check">
          {["check","ach","credit_card","wire","cash","other"].map(x => <option key={x}>{x}</option>)}
        </select>
      </label>
      <label>Reference<input name="reference_number" /></label>
      <label className="full">Notes<textarea name="notes" rows={2} /></label>
      <div className="full"><button className="primary-button" type="submit">Record Payment</button></div>
    </form>
  );
}
