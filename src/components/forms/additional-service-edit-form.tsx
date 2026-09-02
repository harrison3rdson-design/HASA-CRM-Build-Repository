import Link from "next/link";
import { updateAdditionalServiceAction } from "@/app/actions/additional-services";
import {
  ProposalLineItemsFields,
  type ExpenseLineValue,
  type LaborLineValue,
} from "@/components/forms/proposal-line-items-fields";

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
    labor_items?: Array<{
      id: string;
      description: string;
      hours: number | string;
      rate: number | string;
    }>;
    expense_items?: Array<{
      id: string;
      category: string;
      description: string | null;
      estimated_quantity: number | string;
      unit: string | null;
      estimated_rate: number | string;
      billing_rule: ExpenseLineValue["billingRule"];
      markup_percent: number | string;
      requires_receipt: boolean;
    }>;
  };
}) {
  const laborLines: LaborLineValue[] = (authorization.labor_items ?? []).map((item) => ({
    id: item.id,
    description: item.description,
    hours: String(item.hours),
    rate: String(item.rate),
  }));
  const expenseLines: ExpenseLineValue[] = (authorization.expense_items ?? []).map((item) => ({
    id: item.id,
    category: item.category,
    description: item.description ?? "",
    quantity: String(item.estimated_quantity),
    unit: item.unit ?? "",
    rate: String(item.estimated_rate),
    billingRule: item.billing_rule,
    markupPercent: String(item.markup_percent),
    requiresReceipt: item.requires_receipt,
  }));

  return (
    <form action={updateAdditionalServiceAction} className="form-grid">
      <input type="hidden" name="additional_service_id" value={authorization.id} />
      <label className="full">
        Description
        <textarea name="description" rows={7} defaultValue={authorization.description} required />
      </label>
      <label>
        Authorization Type
        <select name="billing_type" defaultValue={authorization.billing_type} required>
          {BILLING_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <div className="project-context"><span>Current Authorized Amount</span><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(authorization.authorized_amount))}</strong><small>Recalculated from the itemized lines when saved.</small></div>
      <ProposalLineItemsFields initialLaborLines={laborLines} initialExpenseLines={expenseLines} totalLabel="Authorized Amount" />
      <div className="full button-row">
        <button className="primary-button" type="submit">Save Authorization</button>
        <Link className="secondary-button" href={`/projects/${authorization.project_id}`}>Back to Project</Link>
      </div>
    </form>
  );
}
