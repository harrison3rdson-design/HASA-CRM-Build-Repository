export type EmailSendInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailDeliveryResult = {
  provider: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  errorMessage?: string;
};

/**
 * Resend-compatible HTTPS adapter.
 * Set EMAIL_PROVIDER_API_URL to another compatible endpoint if desired.
 */
export class TransactionalEmailProvider {
  async sendEmail(input: EmailSendInput): Promise<EmailDeliveryResult> {
    const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
    const from = process.env.EMAIL_FROM;
    const apiUrl = process.env.EMAIL_PROVIDER_API_URL ?? "https://api.resend.com/emails";

    if (!apiKey || !from) {
      return { provider: "email", status: "failed", errorMessage: "Email provider environment variables are incomplete." };
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { provider: "email", status: "failed", errorMessage: data?.message ?? `Email HTTP ${response.status}` };
    }

    return { provider: "email", status: "sent", providerMessageId: data.id };
  }
}
