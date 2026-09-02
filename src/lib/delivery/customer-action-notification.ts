import {
  TransactionalEmailProvider,
  type EmailDeliveryResult,
  type EmailSendInput,
} from "../messaging/email";

export const DEFAULT_CUSTOMER_ACTION_NOTIFICATION_EMAIL =
  "Andy.Harrison@hasaconcepts.com";

type AcceptanceNotificationInput = {
  documentType: "proposal" | "additional_service";
  relatedRecordId: string;
  projectId?: string | null;
  reference: string;
  projectName?: string | null;
  clientName?: string | null;
  signerName: string;
  signerEmail?: string | null;
  signerMobile?: string | null;
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] ?? character
  );

const displayType = (type: AcceptanceNotificationInput["documentType"]) =>
  type === "proposal" ? "proposal" : "additional-service authorization";

const managementUrl = (input: AcceptanceNotificationInput) => {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://hasa-concepts-management.vercel.app"
  ).replace(/\/$/, "");

  return input.documentType === "proposal"
    ? `${baseUrl}/proposals/${input.relatedRecordId}`
    : input.projectId
      ? `${baseUrl}/projects/${input.projectId}`
      : `${baseUrl}/projects`;
};

export function buildAcceptanceNotification(
  input: AcceptanceNotificationInput
): EmailSendInput {
  const type = displayType(input.documentType);
  const reviewUrl = managementUrl(input);
  const details = [
    ["Document", input.reference],
    ["Client", input.clientName],
    ["Project", input.projectName],
    ["Accepted by", input.signerName],
    ["Signer email", input.signerEmail],
    ["Signer mobile", input.signerMobile],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  const textDetails = details.map(([label, value]) => `${label}: ${value}`).join("\n");
  const htmlDetails = details
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:4px 12px 4px 0">${escapeHtml(label)}</th><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  return {
    to:
      process.env.CUSTOMER_ACTION_NOTIFICATION_EMAIL?.trim() ||
      DEFAULT_CUSTOMER_ACTION_NOTIFICATION_EMAIL,
    subject: `Customer accepted ${input.reference}`,
    text: `A customer successfully accepted a HASA Concepts ${type}.\n\n${textDetails}\n\nReview in HASA Concepts Management:\n${reviewUrl}`,
    html: `<p>A customer successfully accepted a HASA Concepts ${escapeHtml(type)}.</p><table>${htmlDetails}</table><p><a href="${escapeHtml(reviewUrl)}">Review in HASA Concepts Management</a></p>`,
    idempotencyKey: `customer-accepted-${input.documentType}-${input.relatedRecordId}`,
  };
}

export async function sendInternalAcceptanceNotification(
  input: AcceptanceNotificationInput
): Promise<EmailDeliveryResult> {
  try {
    return await new TransactionalEmailProvider().sendEmail(
      buildAcceptanceNotification(input)
    );
  } catch (error) {
    return {
      provider: "email",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
