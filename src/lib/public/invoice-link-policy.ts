export const INVOICE_LINK_VALIDITY_DAYS = 120;
export const INVOICE_LINK_VALIDITY_SECONDS = INVOICE_LINK_VALIDITY_DAYS * 24 * 60 * 60;
export const INVOICE_STORAGE_URL_VALIDITY_SECONDS = 10 * 60;

export function invoiceLinkExpiresAt(now = Date.now()): string {
  return new Date(now + INVOICE_LINK_VALIDITY_SECONDS * 1000).toISOString();
}
