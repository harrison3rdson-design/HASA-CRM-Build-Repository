export const PAYMENT_TERMS = ["NET 15", "NET 30", "NET 90"] as const;

export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

export function parsePaymentTerms(value: unknown, field = "Payment terms"): PaymentTerms {
  const terms = String(value ?? "").trim();
  if (!PAYMENT_TERMS.includes(terms as PaymentTerms)) {
    throw new Error(`${field} must be NET 15, NET 30, or NET 90.`);
  }
  return terms as PaymentTerms;
}

