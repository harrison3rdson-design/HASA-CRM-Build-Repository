import { boolValue, numberValue, optionalText, requiredText } from "@/lib/validation/common";
import {
  calculateExpenseAmount,
  calculateLaborAmount,
  parseExpenseBillingRule,
  roundMoney,
} from "@/lib/proposal-items";
import { roundHoursUp } from "@/lib/time-increments";

function itemCount(value: FormDataEntryValue | null, label: string): number {
  const count = numberValue(value, label, { min: 0, max: 50 });
  if (!Number.isInteger(count)) throw new Error(`${label} must be a whole number.`);
  return count;
}

export function parseAdditionalServiceItems(formData: FormData) {
  const laborItems = [] as Array<{
    description: string;
    hours: number;
    rate: number;
    amount: number;
    sort_order: number;
  }>;
  const expenseItems = [] as Array<{
    category: string;
    description: string | null;
    estimated_quantity: number;
    unit: string | null;
    estimated_rate: number;
    estimated_amount: number;
    billing_rule: ReturnType<typeof parseExpenseBillingRule>;
    markup_percent: number;
    requires_receipt: boolean;
    sort_order: number;
  }>;

  const laborCount = itemCount(formData.get("labor_count"), "Labor line count");
  for (let index = 0; index < laborCount; index += 1) {
    const description = optionalText(formData.get(`labor_description_${index}`));
    const hoursText = optionalText(formData.get(`labor_hours_${index}`));
    const rateText = optionalText(formData.get(`labor_rate_${index}`));
    if (!description && !hoursText && !rateText) continue;

    const hours = roundHoursUp(numberValue(hoursText, `Labor line ${index + 1} hours`, { min: 0 }));
    const rate = numberValue(rateText, `Labor line ${index + 1} hourly rate`, { min: 0 });
    laborItems.push({
      description: requiredText(description, `Labor line ${index + 1} description`),
      hours,
      rate,
      amount: calculateLaborAmount(hours, rate),
      sort_order: index,
    });
  }

  const expenseCount = itemCount(formData.get("expense_count"), "Expense line count");
  for (let index = 0; index < expenseCount; index += 1) {
    const category = optionalText(formData.get(`expense_category_${index}`));
    const description = optionalText(formData.get(`expense_description_${index}`));
    const quantityText = optionalText(formData.get(`expense_quantity_${index}`));
    const unit = optionalText(formData.get(`expense_unit_${index}`));
    const rateText = optionalText(formData.get(`expense_rate_${index}`));
    const markupText = optionalText(formData.get(`expense_markup_${index}`));
    const quantityChanged = quantityText !== null && quantityText !== "1";
    const hasMarkup = markupText !== null && Number(markupText) !== 0;
    if (!category && !description && !unit && !rateText && !quantityChanged && !hasMarkup) continue;

    const quantity = numberValue(quantityText ?? "1", `Expense line ${index + 1} quantity`, { min: 0 });
    const rate = numberValue(rateText ?? "0", `Expense line ${index + 1} unit cost`, { min: 0 });
    const markupPercent = numberValue(markupText ?? "0", `Expense line ${index + 1} markup`, { min: 0, max: 999.999 });
    const billingRule = parseExpenseBillingRule(formData.get(`expense_billing_rule_${index}`));
    expenseItems.push({
      category: requiredText(category, `Expense line ${index + 1} category`),
      description,
      estimated_quantity: quantity,
      unit,
      estimated_rate: rate,
      estimated_amount: calculateExpenseAmount(quantity, rate, markupPercent, billingRule),
      billing_rule: billingRule,
      markup_percent: billingRule === "actual_plus_markup" ? markupPercent : 0,
      requires_receipt: boolValue(formData.get(`expense_requires_receipt_${index}`)),
      sort_order: index,
    });
  }

  if (!laborItems.length && !expenseItems.length) {
    throw new Error("Add at least one labor or expense line to the authorization.");
  }

  return {
    laborItems,
    expenseItems,
    authorizedAmount: roundMoney([
      ...laborItems.map((item) => item.amount),
      ...expenseItems.map((item) => item.estimated_amount),
    ].reduce((sum, amount) => sum + amount, 0)),
  };
}
