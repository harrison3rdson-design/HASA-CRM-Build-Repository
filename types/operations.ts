export type InvoiceType =
  | "advance"
  | "progress"
  | "milestone"
  | "hourly"
  | "expense"
  | "final"
  | "credit";

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "sent"
  | "viewed"
  | "partial"
  | "paid"
  | "past_due"
  | "void";

export type ExpenseBillingRule =
  | "actual"
  | "actual_plus_markup"
  | "fixed_rate"
  | "per_diem"
  | "mileage"
  | "allowance"
  | "included"
  | "not_billable";

export interface TimeEntryInput {
  projectId: string;
  phaseId?: string | null;
  userId: string;
  workDate: string;
  activityType: string;
  description?: string;
  hours: number;
  billable: boolean;
  billingRate: number;
  internalCostRate: number;
  isTravelTime: boolean;
}

export interface ExpenseInput {
  projectId: string;
  sourceEstimateId?: string | null;
  expenseDate: string;
  category: string;
  description?: string;
  vendor?: string;
  actualCost: number;
  billable: boolean;
  billableAmount: number;
  billingRule: ExpenseBillingRule;
  markupPercent?: number;
}

export interface ProjectFinancialSummary {
  project_id: string;
  project_number: string;
  project_name: string;
  original_contract_amount: number;
  additional_services_amount: number;
  authorized_fee: number;
  total_hours_worked: number;
  billable_time_value: number;
  internal_labor_cost: number;
  actual_expenses: number;
  billable_expenses: number;
  total_invoiced: number;
  payments_received: number;
  outstanding_ar: number;
  remaining_authorized_fee: number;
  estimated_gross_margin_before_overhead: number;
}
