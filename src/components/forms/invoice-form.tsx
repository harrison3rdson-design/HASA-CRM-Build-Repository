import { createInvoiceAction } from "@/app/actions/invoices";

export function InvoiceForm({ projects }: { projects: Array<{ id: string; project_number: string; project_name: string }> }) {
  return (
    <form action={createInvoiceAction} className="form-grid">
      <label>Project
        <select name="project_id" required>
          <option value="">Select project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.project_name}</option>)}
        </select>
      </label>
      <label>Invoice Type
        <select name="invoice_type" defaultValue="progress">
          {["advance","progress","milestone","hourly","expense","final","credit"].map(x => <option key={x}>{x}</option>)}
        </select>
      </label>
      <label>Invoice Date<input name="invoice_date" type="date" required /></label>
      <label>Due Date<input name="due_date" type="date" /></label>
      <label>Payment Terms<input name="payment_terms" defaultValue="NET 15" /></label>
      <label className="full">Customer Notes<textarea name="customer_notes" rows={3} /></label>
      <label className="check"><input name="include_expense_detail" type="checkbox" /> Include Expense Detail</label>
      <label className="check"><input name="include_receipt_appendix" type="checkbox" /> Include Receipt Appendix</label>
      <div className="full"><button className="primary-button" type="submit">Create Draft Invoice</button></div>
    </form>
  );
}
