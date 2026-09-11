import { createAdminClient } from "@/lib/supabase-admin";
import {
  TransactionalEmailProvider,
  type EmailDeliveryResult,
} from "@/lib/messaging/email";
import { DEFAULT_CUSTOMER_ACTION_NOTIFICATION_EMAIL } from "@/lib/delivery/customer-action-notification";
import { money } from "@/lib/ui/format";

type AcceptedProposalPackageInput = {
  proposalId: string;
  clientId: string;
  projectId: string | null;
  proposalNumber: string;
  projectName: string;
  clientName?: string | null;
  signerName: string;
  customerEmail: string;
  acceptanceVersionId: string;
  acceptedTotal: number;
  filename: string;
  pdfBytes: Buffer;
};

type Recipient = {
  kind: "customer" | "hasa";
  name: string;
  email: string;
};

const escapeHtml = (value: string) => value.replace(
  /[&<>'"]/g,
  (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character,
);

async function sendToRecipient(
  input: AcceptedProposalPackageInput,
  recipient: Recipient,
): Promise<EmailDeliveryResult> {
  const provider = new TransactionalEmailProvider();
  const internal = recipient.kind === "hasa";
  const subject = internal
    ? `Accepted proposal ${input.proposalNumber} · ${money(input.acceptedTotal)}`
    : `Final accepted proposal ${input.proposalNumber}`;
  const summary = internal
    ? `${input.signerName} accepted proposal ${input.proposalNumber} for ${input.projectName}. Final accepted contract: ${money(input.acceptedTotal)}. Acceptance ID: ${input.acceptanceVersionId}.`
    : `Thank you for approving proposal ${input.proposalNumber} for ${input.projectName}. The attached PDF is the final accepted contract package and includes your choices, terms, total, and electronic acceptance record. Acceptance ID: ${input.acceptanceVersionId}.`;

  try {
    return await provider.sendEmail({
      to: recipient.email,
      subject,
      text: `${summary}\n\nPlease retain the attached PDF for your records.`,
      html: `<p>${escapeHtml(summary)}</p><p>Please retain the attached PDF for your records.</p>`,
      attachments: [{
        filename: input.filename,
        content: input.pdfBytes.toString("base64"),
        contentType: "application/pdf",
      }],
      idempotencyKey: `accepted-proposal-${input.acceptanceVersionId}-${recipient.kind}`,
    });
  } catch (error) {
    return {
      provider: "email",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function deliverAcceptedProposalPackage(input: AcceptedProposalPackageInput) {
  const internalEmail = process.env.CUSTOMER_ACTION_NOTIFICATION_EMAIL?.trim()
    || DEFAULT_CUSTOMER_ACTION_NOTIFICATION_EMAIL;
  const recipients: Recipient[] = [
    { kind: "customer", name: input.signerName, email: input.customerEmail },
    { kind: "hasa", name: "HASA Concepts", email: internalEmail },
  ];
  const uniqueRecipients = recipients.filter((recipient, index) => (
    recipients.findIndex((candidate) => candidate.email.toLowerCase() === recipient.email.toLowerCase()) === index
  ));
  const results = await Promise.all(uniqueRecipients.map(async (recipient) => ({
    recipient,
    result: await sendToRecipient(input, recipient),
  })));

  const admin = createAdminClient();
  await Promise.all(results.map(async ({ recipient, result }) => {
    const { error } = await admin.from("document_deliveries").insert({
      client_id: input.clientId,
      project_id: input.projectId,
      document_type: "proposal",
      related_record_id: input.proposalId,
      delivery_method: "email",
      recipient_name: recipient.name,
      recipient_address: recipient.email,
      provider: result.provider,
      provider_message_id: result.providerMessageId ?? null,
      status: result.status,
      error_message: result.errorMessage ?? null,
      sent_at: result.status === "sent" ? new Date().toISOString() : null,
    });
    if (error) {
      console.error("[accepted-proposal-delivery-audit] failed", {
        proposalId: input.proposalId,
        recipient: recipient.kind,
        error: error.message,
      });
    }
  }));

  const failed = results.filter(({ result }) => result.status === "failed");
  return {
    emailedTo: results
      .filter(({ result }) => result.status === "sent")
      .map(({ recipient }) => recipient.email),
    deliveryWarning: failed.length
      ? "Your approval is complete, but one or more contract emails could not be delivered automatically. HASA Concepts can resend the retained final PDF from the proposal record."
      : null,
    results,
  };
}
