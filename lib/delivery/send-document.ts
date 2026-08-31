import { createAdminClient } from "@/lib/supabase-admin";
import { TwilioSmsProvider } from "@/lib/messaging/twilio";
import { TransactionalEmailProvider } from "@/lib/messaging/email";

export async function deliverPublicLink(input: {
  documentType: "proposal" | "additional_service" | "invoice";
  relatedRecordId: string;
  url: string;
  recipientName?: string | null;
  email?: string | null;
  mobile?: string | null;
  method: "sms" | "email" | "both";
  subject: string;
  message: string;
}) {
  const admin = createAdminClient();
  const sms = new TwilioSmsProvider();
  const email = new TransactionalEmailProvider();
  const results: any[] = [];

  if ((input.method === "sms" || input.method === "both") && input.mobile) {
    const r = await sms.sendSms({ to: input.mobile, body: `${input.message}\n${input.url}` });
    results.push({ method: "sms", address: input.mobile, ...r });
  }

  if ((input.method === "email" || input.method === "both") && input.email) {
    const r = await email.sendEmail({
      to: input.email,
      subject: input.subject,
      text: `${input.message}\n\n${input.url}`,
      html: `<p>${input.message}</p><p><a href="${input.url}">Open document</a></p>`,
    });
    results.push({ method: "email", address: input.email, ...r });
  }

  for (const r of results) {
    await admin.from("document_deliveries").insert({
      document_type: input.documentType,
      related_record_id: input.relatedRecordId,
      delivery_method: r.method,
      recipient_name: input.recipientName ?? null,
      recipient_address: r.address,
      provider: r.provider,
      provider_message_id: r.providerMessageId ?? null,
      status: r.status,
      error_message: r.errorMessage ?? null,
      sent_at: r.status === "sent" || r.status === "delivered" ? new Date().toISOString() : null,
    });
  }

  return results;
}
