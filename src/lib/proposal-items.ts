export const EXPENSE_BILLING_RULES = [
  "actual",
  "actual_plus_markup",
  "fixed_rate",
  "per_diem",
  "mileage",
  "allowance",
  "included",
  "not_billable",
] as const;

export type ExpenseBillingRule = (typeof EXPENSE_BILLING_RULES)[number];

export const SERVICE_BILLING_TYPES = ["hourly", "unit", "fixed", "included"] as const;

export type ServiceBillingType = (typeof SERVICE_BILLING_TYPES)[number];

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateLaborAmount(hours: number, hourlyRate: number): number {
  return roundMoney(hours * hourlyRate);
}

export function calculateServiceAmount(
  billingType: ServiceBillingType,
  quantity: number,
  rate: number,
): number {
  if (billingType === "included") return 0;
  if (billingType === "fixed") return roundMoney(rate);
  return roundMoney(quantity * rate);
}

export function parseServiceBillingType(
  value: FormDataEntryValue | null,
): ServiceBillingType {
  const billingType = String(value ?? "hourly");
  if (!SERVICE_BILLING_TYPES.includes(billingType as ServiceBillingType)) {
    throw new Error("Service pricing basis is invalid.");
  }
  return billingType as ServiceBillingType;
}

export function calculateMaterialUnitPrice(unitCost: number, markupPercent: number): number {
  return roundMoney(unitCost * (1 + markupPercent / 100));
}

export function calculateMaterialAmount(
  quantity: number,
  unitCost: number,
  markupPercent: number,
): number {
  return roundMoney(quantity * calculateMaterialUnitPrice(unitCost, markupPercent));
}

export function calculateExpenseAmount(
  quantity: number,
  rate: number,
  markupPercent: number,
  billingRule: ExpenseBillingRule,
): number {
  if (billingRule === "included" || billingRule === "not_billable") return 0;

  const baseAmount = quantity * rate;
  const multiplier = billingRule === "actual_plus_markup" ? 1 + markupPercent / 100 : 1;
  return roundMoney(baseAmount * multiplier);
}

export function parseExpenseBillingRule(value: FormDataEntryValue | null): ExpenseBillingRule {
  const rule = String(value ?? "actual");
  if (!EXPENSE_BILLING_RULES.includes(rule as ExpenseBillingRule)) {
    throw new Error("Expense billing rule is invalid.");
  }
  return rule as ExpenseBillingRule;
}
