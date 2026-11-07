import { addInvoiceItemAction } from "@/app/actions/invoices";

export function DirectInvoiceItemForm({ invoiceId }: { invoiceId: string }) {
  return (
    <form action={addInvoiceItemAction} className="form-grid">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <label>Line Type
        <select name="item_type" defaultValue="professional_fee" required>
          <option value="professional_fee">Professional service</option>
          <option value="expense">Expense or material</option>
          <option value="adjustment">Adjustment</option>
          <option value="credit">Credit</option>
        </select>
      </label>
      <label>Description
        <input name="description" required maxLength={500} />
      </label>
      <label>Quantity
        <input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" required />
      </label>
      <label>Rate
        <input name="rate" type="number" min="0" step="0.01" defaultValue="0.00" required />
        <span>For a credit, enter a positive rate; the CRM subtracts it automatically.</span>
      </label>
      <div className="full"><button className="primary-button" type="submit">Add Line Item</button></div>
    </form>
  );
}
