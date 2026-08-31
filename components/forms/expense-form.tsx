import { createExpenseAction } from "@/app/actions/expenses";

export function ExpenseForm({ projects }: { projects: Array<{ id: string; project_number: string; project_name: string }> }) {
  return (
    <form action={createExpenseAction} className="form-grid">
      <label>Project
        <select name="project_id" required>
          <option value="">Select project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.project_name}</option>)}
        </select>
      </label>
      <label>Date<input name="expense_date" type="date" required /></label>
      <label>Category<input name="category" required /></label>
      <label>Vendor<input name="vendor" /></label>
      <label>Actual Cost<input name="actual_cost" type="number" min="0" step="0.01" required /></label>
      <label>Billing Rule
        <select name="billing_rule" defaultValue="actual">
          {["actual","actual_plus_markup","fixed_rate","per_diem","mileage","allowance","included","not_billable"].map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </label>
      <label>Markup %<input name="markup_percent" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <label>Fixed Billable Amount<input name="fixed_billable_amount" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <label className="full">Description<textarea name="description" rows={3} /></label>
      <label className="check"><input name="billable" type="checkbox" defaultChecked /> Billable</label>
      <div className="full"><button className="primary-button" type="submit">Save Expense</button></div>
    </form>
  );
}
