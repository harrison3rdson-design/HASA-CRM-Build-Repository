export interface DeliveryResult {
  provider: string;
  providerMessageId?: string;
  status: "sent" | "failed";
  errorMessage?: string;
}

export interface SmsProvider {
  sendSms(input: { to: string; body: string }): Promise<DeliveryResult>;
}

export interface EmailProvider {
  sendEmail(input: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<DeliveryResult>;
}

/**
 * Provider adapters (Twilio, Resend/SendGrid/etc.) should implement these
 * interfaces so customer delivery remains replaceable and testable.
 */
