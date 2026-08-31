import { createAdditionalServiceAction } from "@/app/actions/additional-services";

export function AdditionalServiceForm({ projectId }: { projectId: string }) {
  return (
    <form action={createAdditionalServiceAction} className="form-grid">
      <input type="hidden" name="project_id" value={projectId} />
      <label className="full">Description<textarea name="description" rows={4} required /></label>
      <label>Billing Type
        <select name="billing_type" defaultValue="fixed">
          {["fixed","hourly","not_to_exceed","unit","allowance"].map(x => <option key={x}>{x}</option>)}
        </select>
      </label>
      <label>Authorized Amount<input name="authorized_amount" type="number" min="0" step="0.01" required /></label>
      <div className="full"><button className="primary-button" type="submit">Create Authorization</button></div>
    </form>
  );
}
