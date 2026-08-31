export function money(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function calculateExpenseBillableAmount(input: {
  actualCost: number;
  rule: "actual" | "actual_plus_markup" | "fixed_rate" | "per_diem" |
        "mileage" | "allowance" | "included" | "not_billable";
  markupPercent?: number;
  fixedBillableAmount?: number;
}): number {
  const actual = money(input.actualCost);
  const markup = Number(input.markupPercent ?? 0);

  switch (input.rule) {
    case "actual":
      return actual;
    case "actual_plus_markup":
      return money(actual * (1 + markup / 100));
    case "fixed_rate":
    case "per_diem":
    case "mileage":
    case "allowance":
      return money(input.fixedBillableAmount ?? 0);
    case "included":
    case "not_billable":
      return 0;
    default:
      return 0;
  }
}
