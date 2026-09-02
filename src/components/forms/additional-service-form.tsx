import { createAdditionalServiceAction } from "@/app/actions/additional-services";

export function AdditionalServiceForm({ projectId }: { projectId: string }) {
  return (
    <form action={createAdditionalServiceAction} className="form-grid">
      <input type="hidden" name="project_id" value={projectId} />
      <label className="full">Description<textarea name="description" rows={4} required /></label>
      <label>Billing Type
        <select name="billing_type" defaultValue="fixed">
          <option value="fixed">Fixed fee</option>
          <option value="hourly">Hourly</option>
          <option value="not_to_exceed">Not to exceed</option>
          <option value="unit">Unit rate</option>
          <option value="allowance">Allowance</option>
        </select>
      </label>
      <label>Authorized Amount<input name="authorized_amount" type="number" min="0" step="0.01" required /></label>
      <p className="full footnote">This creates an editable draft. You can preview it before choosing Email or Text and sending it for customer approval.</p>
      <div className="full"><button className="primary-button" type="submit">Create Draft Authorization</button></div>
    </form>
  );
}
