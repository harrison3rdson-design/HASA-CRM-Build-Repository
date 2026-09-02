import { parsePaymentTerms, type PaymentTerms } from "../payment-terms";

const PAYMENT_TERM_DAYS: Record<PaymentTerms, number> = {
  "NET 15": 15,
  "NET 30": 30,
  "NET 90": 90,
};

export const INVOICE_TIME_ZONE = "America/New_York";

export function getPaymentTermDays(value: unknown): number {
  return PAYMENT_TERM_DAYS[parsePaymentTerms(value)];
}

export function calculateInvoiceDueDate(
  sentAt: Date | string,
  paymentTerms: unknown,
  timeZone = INVOICE_TIME_ZONE,
): string {
  const sentDate = sentAt instanceof Date ? new Date(sentAt.getTime()) : new Date(sentAt);
  if (Number.isNaN(sentDate.getTime())) {
    throw new Error("Invoice sent date is invalid.");
  }

  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(sentDate);
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    const value = dateParts.find((item) => item.type === type)?.value;
    if (!value) throw new Error("Invoice sent date could not be calculated.");
    return Number(value);
  };

  const dueDate = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  dueDate.setUTCDate(dueDate.getUTCDate() + getPaymentTermDays(paymentTerms));
  return dueDate.toISOString().slice(0, 10);
}
