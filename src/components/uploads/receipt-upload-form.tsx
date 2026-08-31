import { uploadReceiptForExpenseAction } from "@/app/actions/expenses";

export function ReceiptUploadForm({
  clientId, projectId, expenseId
}: { clientId: string; projectId: string; expenseId: string }) {
  return (
    <form action={uploadReceiptForExpenseAction} className="form-grid">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="expense_id" value={expenseId} />
      <label className="full">Receipt
        <input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
      </label>
      <div className="full"><button className="primary-button" type="submit">Upload Receipt</button></div>
    </form>
  );
}
