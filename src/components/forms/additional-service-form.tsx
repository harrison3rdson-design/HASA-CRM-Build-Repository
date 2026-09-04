import { createAdditionalServiceAction } from "@/app/actions/additional-services";
import { ProposalLineItemsFields } from "@/components/forms/proposal-line-items-fields";

export function AdditionalServiceForm({ projectId }: { projectId: string }) {
  return (
    <form action={createAdditionalServiceAction} className="form-grid">
      <input type="hidden" name="project_id" value={projectId} />
      <label className="full">Description<textarea name="description" rows={4} required /></label>
      <label>Authorization Type
        <select name="billing_type" defaultValue="not_to_exceed">
          <option value="fixed">Fixed fee</option>
          <option value="hourly">Hourly</option>
          <option value="not_to_exceed">Not to exceed</option>
          <option value="unit">Unit rate</option>
          <option value="allowance">Allowance</option>
        </select>
      </label>
      <div className="project-context"><span>Authorized Amount</span><strong>Calculated below</strong><small>Labor and estimated expenses are added automatically.</small></div>
      <ProposalLineItemsFields totalLabel="Authorized Amount" allowServicePricing={false} />
      <p className="full footnote">This creates an editable draft. You can preview it before choosing Email or Text and sending it for customer approval.</p>
      <div className="full"><button className="primary-button" type="submit">Create Draft Authorization</button></div>
    </form>
  );
}
