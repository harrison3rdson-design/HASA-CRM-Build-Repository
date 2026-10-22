export type EmailSendInput = {
  to: string;
  cc?: string | string[];
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
};

export function normalizeEmailCcRecipients(
  to: string,
  cc: EmailSendInput["cc"],
): string[] {
  const primaryRecipient = to.trim().toLowerCase();
  const recipients = Array.isArray(cc) ? cc : cc ? [cc] : [];
  const unique = new Map<string, string>();

  for (const recipient of recipients) {
    const trimmed = recipient.trim();
    const normalized = trimmed.toLowerCase();
    if (trimmed && normalized !== primaryRecipient && !unique.has(normalized)) {
      unique.set(normalized, trimmed);
    }
  }

  return [...unique.values()];
}

export type EmailDeliveryResult = {
  provider: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  errorMessage?: string;
};

export function isTransactionalEmailConfigured(
  environment: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return Boolean(environment.EMAIL_PROVIDER_API_KEY && environment.EMAIL_FROM);
}

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

    const cc = normalizeEmailCcRecipients(input.to, input.cc);
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : {}),
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        cc: cc.length ? cc : undefined,
        subject: input.subject,
        text: input.text,
        html: input.html,
        attachments: input.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          content_type: attachment.contentType,
        })),
      }),
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { provider: "email", status: "failed", errorMessage: data?.message ?? `Email HTTP ${response.status}` };
    }

    return { provider: "email", status: "sent", providerMessageId: data.id };
  }
}
