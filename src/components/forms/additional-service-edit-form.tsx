import Link from "next/link";
import { updateAdditionalServiceAction } from "@/app/actions/additional-services";

const BILLING_TYPES = [
  ["fixed", "Fixed fee"],
  ["hourly", "Hourly"],
  ["not_to_exceed", "Not to exceed"],
  ["unit", "Unit rate"],
  ["allowance", "Allowance"],
] as const;

export function AdditionalServiceEditForm({
  authorization,
}: {
  authorization: {
    id: string;
    project_id: string;
    description: string;
    billing_type: string;
    authorized_amount: number | string;
  };
}) {
  return (
    <form action={updateAdditionalServiceAction} className="form-grid">
      <input type="hidden" name="additional_service_id" value={authorization.id} />
      <label className="full">
        Description
        <textarea name="description" rows={7} defaultValue={authorization.description} required />
      </label>
      <label>
        Billing Type
        <select name="billing_type" defaultValue={authorization.billing_type} required>
          {BILLING_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>
        Authorized Amount
        <input
          name="authorized_amount"
          type="number"
          min="0"
          step="0.01"
          defaultValue={authorization.authorized_amount}
          required
        />
      </label>
      <div className="full button-row">
        <button className="primary-button" type="submit">Save Authorization</button>
        <Link className="secondary-button" href={`/projects/${authorization.project_id}`}>Back to Project</Link>
      </div>
    </form>
  );
}
