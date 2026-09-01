export type SmsSendInput = { to: string; body: string };
export type DeliveryResult = {
  provider: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  errorMessage?: string;
};

export function isTwilioConfigured(environment = process.env): boolean {
  return Boolean(
    environment.TWILIO_ACCOUNT_SID
    && environment.TWILIO_AUTH_TOKEN
    && environment.TWILIO_FROM_NUMBER,
  );
}

export class TwilioSmsProvider {
  async sendSms(input: SmsSendInput): Promise<DeliveryResult> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (!sid || !token || !from) {
      return { provider: "twilio", status: "failed", errorMessage: "Twilio environment variables are incomplete." };
    }

    const body = new URLSearchParams({
      To: input.to,
      From: from,
      Body: input.body,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    );

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { provider: "twilio", status: "failed", errorMessage: data?.message ?? `Twilio HTTP ${response.status}` };
    }

    return { provider: "twilio", status: "sent", providerMessageId: data.sid };
  }
}
