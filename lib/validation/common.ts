export function requiredText(value: FormDataEntryValue | null, field: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} is required.`);
  return text;
}

export function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

export function numberValue(
  value: FormDataEntryValue | null,
  field: string,
  options: { min?: number; max?: number } = {}
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${field} must be a valid number.`);
  if (options.min !== undefined && n < options.min) throw new Error(`${field} must be at least ${options.min}.`);
  if (options.max !== undefined && n > options.max) throw new Error(`${field} must be no greater than ${options.max}.`);
  return n;
}

export function boolValue(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}
