const SMS_BRAND = "HASA Concepts";
const SMS_OPT_OUT = "Reply STOP to opt out.";

export function formatTransactionalSms(message: string, url: string): string {
  return `${SMS_BRAND}: ${message.trim()}\n${url.trim()}\n${SMS_OPT_OUT}`;
}
