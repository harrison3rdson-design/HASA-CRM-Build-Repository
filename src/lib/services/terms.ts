export type ServiceTerms = {
  conditions?: string;
  name: string;
  monthlyFee: number;
  refreshMonthlyFee: number;
  termMonths: number;
  modelAllowance: number;
  maintenanceMinutes: number;
  scope: string;
  refreshScope: string;
};

export const SERVICE_PLANS = [
  {
    name: "Portfolio 5",
    monthlyFee: 149,
    modelAllowance: 5,
    maintenanceMinutes: 30,
  },
  {
    name: "Portfolio 15",
    monthlyFee: 349,
    modelAllowance: 15,
    maintenanceMinutes: 60,
  },
  {
    name: "Portfolio 30",
    monthlyFee: 599,
    modelAllowance: 30,
    maintenanceMinutes: 120,
  },
  {
    name: "Facility Access",
    monthlyFee: 99,
    modelAllowance: 2,
    maintenanceMinutes: 0,
  },
  {
    name: "Facility Care",
    monthlyFee: 299,
    modelAllowance: 5,
    maintenanceMinutes: 90,
  },
  {
    name: "Facility Partner",
    monthlyFee: 699,
    modelAllowance: 10,
    maintenanceMinutes: 240,
  },
] as const;

export const SERVICE_CONDITIONS =
  "Initial capture is charged separately. Service begins on the agreed activation date after delivery. Monthly fees are billed in advance and due on receipt for the stated fixed term; renewal requires a new agreement. Included maintenance time expires each calendar month with no rollover. Hosting keeps models accessible; remote maintenance updates labels, tags and client-supplied links. Physical changes require separately scoped recapture. Historical versions and large models consume additional capacity. Unused refresh visits expire at term end; any unpaid portion of the agreed refresh fee is due before the visit. Travel, CAD, exports and code consulting are excluded unless expressly included in the scope. Transfer and retention arrangements must be specified in the scope.";

export function parseServiceTerms(value: unknown): ServiceTerms | null {
  if (value == null || value === "") return null;
  const input = typeof value === "string" ? JSON.parse(value) : value;
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid recurring service terms.");
  const text = (key: string, required: boolean, max: number) => {
    if (typeof input[key] !== "string")
      throw new Error(`Invalid service ${key}.`);
    const result = input[key].trim();
    if ((required && !result) || result.length > max)
      throw new Error(`Enter service ${key} (maximum ${max} characters).`);
    return result;
  };
  const number = (key: string, max: number, integer = false) => {
    const result = input[key];
    if (
      typeof result !== "number" ||
      !Number.isFinite(result) ||
      result < 0 ||
      result > max ||
      (integer && !Number.isInteger(result))
    )
      throw new Error(`Invalid service ${key}.`);
    return integer ? result : Math.round(result * 100) / 100;
  };
  const terms = {
    conditions: SERVICE_CONDITIONS,
    name: text("name", true, 150),
    monthlyFee: number("monthlyFee", 1000000),
    refreshMonthlyFee: number("refreshMonthlyFee", 1000000),
    termMonths: number("termMonths", 60, true),
    modelAllowance: number("modelAllowance", 10000, true),
    maintenanceMinutes: number("maintenanceMinutes", 100000, true),
    scope: text("scope", true, 10000),
    refreshScope: text("refreshScope", false, 5000),
  };
  if (terms.termMonths < 1 || terms.modelAllowance < 1 || terms.monthlyFee <= 0)
    throw new Error(
      "Monthly fee, term and model allowance must be greater than zero.",
    );
  if (terms.refreshMonthlyFee > 0 && !terms.refreshScope)
    throw new Error(
      "Describe the paid refresh scope, visits and travel allowance.",
    );
  return terms;
}

export function monthlyTotal(terms: ServiceTerms) {
  return Math.round((terms.monthlyFee + terms.refreshMonthlyFee) * 100) / 100;
}
export function todayInNewYork() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function safeModelUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Enter an HTTPS model link without credentials.");
  return url.toString();
}
export function calendarMonthMinutes(
  entries: { work_date: string; minutes: number }[],
  today: string,
) {
  return entries
    .filter((e) => e.work_date.slice(0, 7) === today.slice(0, 7))
    .reduce((sum, e) => sum + Number(e.minutes), 0);
}
