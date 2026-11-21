"use server";

import { revalidatePath } from "next/cache";
import { Policies } from "@/lib/auth/action-policy";
import { createAdminClient } from "@/lib/supabase-admin";
import { generateInvoicePdf } from "@/lib/invoices/render";
import { deliverPublicLink } from "@/lib/delivery/send-document";
import { calculateInvoiceDueDate } from "@/lib/invoices/due-date";
import { isTransactionalEmailConfigured } from "@/lib/messaging/email";
import { isTwilioConfigured } from "@/lib/messaging/twilio";
import { resolveAppUrl } from "@/lib/app-url";
import {
  activateInvoiceShareLink,
  createInvoiceShareLink,
  revokeInvoiceShareLink,
} from "@/lib/public/invoice";
import {
  normalizeRelatedContact,
  selectDefaultProposalContact,
} from "@/lib/proposal-contacts";

type DeliveryMethod = "sms" | "email" | "both";

type SendInvoiceResult =
  | { ok: true; results: Awaited<ReturnType<typeof deliverPublicLink>> }
  | { ok: false; error: string };

const RESENDABLE_INVOICE_STATUSES = new Set([
  "sent",
  "viewed",
  "partial",
  "paid",
  "past_due",
]);

function requestedProviderError(method: DeliveryMethod): string | null {
  const errors: string[] = [];
  if ((method === "sms" || method === "both") && !isTwilioConfigured()) {
    errors.push("Text messaging is not configured for this app.");
  }
  if ((method === "email" || method === "both") && !isTransactionalEmailConfigured()) {
    errors.push("Email delivery is not configured for this app.");
  }
  return errors.length ? errors.join(" ") : null;
}

function logInvoiceDelivery(level: "info" | "error", message: string, invoiceId: string, method: string, error?: string) {
  const entry = JSON.stringify({
    level,
    message,
    invoiceId,
    method,
    ...(error ? { error } : {}),
  });
  if (level === "error") console.error(entry);
  else console.log(entry);
}

async function cleanUpFailedInvoiceDelivery(input: {
  admin: ReturnType<typeof createAdminClient>;
  invoiceId: string;
  method: string;
  tokenHash: string | null;
  generatedDocumentId: string | null;
}) {
  const failures: string[] = [];
  if (input.tokenHash) {
    try {
      await revokeInvoiceShareLink(input.tokenHash);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Unable to revoke the new invoice link.");
    }
  }
  if (input.generatedDocumentId) {
    const { error } = await input.admin
      .from("generated_documents")
      .delete()
      .eq("id", input.generatedDocumentId);
    if (error) failures.push(error.message);
  }
  if (failures.length) {
    logInvoiceDelivery(
      "error",
      "Invoice delivery cleanup was incomplete",
      input.invoiceId,
      input.method,
      failures.join(" "),
    );
  }
}

export async function generateAndSendInvoiceAction(input:{
  invoiceId:string;
  method:DeliveryMethod;
}): Promise<SendInvoiceResult> {
  await Policies.invoiceIssue();
  const admin=createAdminClient();

  const {data:invoice,error}=await admin.from("invoices").select(`
    invoice_number,project_id,client_id,contact_id,payment_terms,total,status,locked,issued_at,sent_at,due_date,
    client:clients(company_name),
    contact:contacts(id,first_name,last_name,email,mobile_phone,is_primary),
    project:projects(id,client_id,primary_contact_id,primary_contact:contacts(id,first_name,last_name,email,mobile_phone,is_primary))
  `).eq("id",input.invoiceId).single();
  if(error) throw error;
  const isInitialSend = !invoice.sent_at
    && (invoice.status === "draft" || invoice.status === "issued");
  const isResend = Boolean(invoice.sent_at)
    && RESENDABLE_INVOICE_STATUSES.has(invoice.status);
  if (!isInitialSend && !isResend) {
    throw new Error("Only an unsent invoice or a previously sent active invoice can be delivered.");
  }

  const project = Array.isArray(invoice.project) ? invoice.project[0] : invoice.project;
  let contact = normalizeRelatedContact(invoice.contact) ?? normalizeRelatedContact(project?.primary_contact);
  if (!contact && invoice.client_id) {
    const { data: contacts, error: contactsError } = await admin
      .from("contacts")
      .select("id,first_name,last_name,email,mobile_phone,is_primary")
      .eq("client_id", invoice.client_id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (contactsError) throw contactsError;
    contact = selectDefaultProposalContact(contacts ?? []);

    if (contact) {
      const assignQuery = project
        ? admin.from("projects").update({ primary_contact_id: contact.id }).eq("id", project.id).is("primary_contact_id", null)
        : admin.from("invoices").update({ contact_id: contact.id }).eq("id", input.invoiceId).is("contact_id", null);
      const { error: assignError } = await assignQuery;
      if (assignError) throw assignError;
    }
  }

  if (!contact?.email && !contact?.mobile_phone) {
    return { ok: false, error: "Assign a billing contact with an email address or mobile number before sending." };
  }
  if ((input.method === "email" || input.method === "both") && !contact.email) {
    return { ok: false, error: "The billing contact does not have an email address." };
  }
  if ((input.method === "sms" || input.method === "both") && !contact.mobile_phone) {
    return { ok: false, error: "The billing contact does not have a mobile number." };
  }
  if (Number(invoice.total) <= 0) {
    return { ok: false, error: "Add invoice line items with a total greater than zero before sending." };
  }

  const providerError = requestedProviderError(input.method);
  if (providerError) {
    logInvoiceDelivery("error", "Invoice delivery configuration is incomplete", input.invoiceId, input.method, providerError);
    return { ok: false, error: providerError };
  }

  const sentAt = new Date();
  const dueDate = isResend
    ? invoice.due_date
    : calculateInvoiceDueDate(sentAt, invoice.payment_terms);
  let results: Awaited<ReturnType<typeof deliverPublicLink>>;
  let tokenHash: string | null = null;
  let generatedDocumentId: string | null = null;
  try {
    let documentId: string;
    if (isResend) {
      const { data: existingDocument, error: existingDocumentError } = await admin
        .from("generated_documents")
        .select("id")
        .eq("document_type", "invoice")
        .eq("related_record_id", input.invoiceId)
        .eq("locked", true)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingDocumentError) throw existingDocumentError;
      if (!existingDocument) {
        throw new Error("The locked invoice PDF could not be found. Contact support before resending this invoice.");
      }
      documentId = existingDocument.id;
    } else {
      const generated = await generateInvoicePdf(input.invoiceId, { dueDate: dueDate ?? undefined });
      const { data: generatedDocument, error: documentError } = await admin
        .from("generated_documents")
        .insert({
          client_id: invoice.client_id,
          project_id: invoice.project_id,
          document_type: "invoice",
          related_record_id: input.invoiceId,
          storage_path: generated.path,
          original_filename: `${invoice.invoice_number}.pdf`,
          mime_type: "application/pdf",
          sha256_hash: generated.sha256,
          locked: true,
        })
        .select("id")
        .single();
      if (documentError) throw documentError;
      documentId = generatedDocument.id;
      generatedDocumentId = generatedDocument.id;
    }

    const link = await createInvoiceShareLink({
      invoiceId: input.invoiceId,
      documentId,
    });
    tokenHash = link.tokenHash;
    const url = `${resolveAppUrl()}/public/invoices/${link.token}`;
    logInvoiceDelivery("info", isResend ? "Invoice resend started" : "Invoice delivery started", input.invoiceId, input.method);
    results=await deliverPublicLink({
      documentType:"invoice",
      relatedRecordId:input.invoiceId,
      url,
      recipientName:[contact.first_name,contact.last_name].filter(Boolean).join(" "),
      email:contact.email,
      mobile:contact.mobile_phone,
      method:input.method,
      subject:`HASA Concepts Invoice ${invoice.invoice_number}`,
      message:`Invoice ${invoice.invoice_number} is available for review.`,
      idempotencyKey:`invoice-${input.invoiceId}-${link.tokenHash.slice(0, 24)}`,
    });
  } catch (caught) {
    await cleanUpFailedInvoiceDelivery({
      admin,
      invoiceId: input.invoiceId,
      method: input.method,
      tokenHash,
      generatedDocumentId,
    });
    const message = caught instanceof Error ? caught.message : "The invoice could not be delivered.";
    logInvoiceDelivery("error", "Invoice delivery failed before completion", input.invoiceId, input.method, message);
    return {
      ok: false,
      error: `${message} ${isResend
        ? "The existing invoice and due date were not changed."
        : invoice.status === "draft"
          ? "The invoice remains editable and unlocked."
          : "The invoice remains issued and unsent."}`,
    };
  }

  const delivered = results.some((result) => result.status === "sent" || result.status === "delivered");
  if (!delivered) {
    await cleanUpFailedInvoiceDelivery({
      admin,
      invoiceId: input.invoiceId,
      method: input.method,
      tokenHash,
      generatedDocumentId,
    });
    const providerMessages = results
      .filter((result) => result.status === "failed")
      .map((result) => result.errorMessage)
      .filter(Boolean);
    const message = providerMessages.length
      ? providerMessages.join(" ")
      : "The invoice was not delivered.";
    logInvoiceDelivery("error", "Invoice delivery was rejected", input.invoiceId, input.method, message);
    return {
      ok: false,
      error: isResend
        ? `${message} The existing invoice, due date, and prior link were not changed.`
        : `${message} Its due-date period has not started, and ${invoice.status === "draft"
          ? "the invoice remains editable and unlocked."
          : "the invoice remains issued and unsent."}`,
    };
  }

  if (!tokenHash) throw new Error("The invoice delivery completed without a valid customer link.");
  await activateInvoiceShareLink(input.invoiceId, tokenHash);

  if (isResend) {
    revalidatePath(`/billing/${input.invoiceId}`);
    logInvoiceDelivery("info", "Invoice resent with a fresh 120-day link", input.invoiceId, input.method);
    return { ok: true, results };
  }

  if (invoice.status === "draft") {
    const { error: issueError } = await admin.rpc("issue_invoice", { p_invoice_id: input.invoiceId });
    if (issueError) {
      logInvoiceDelivery("error", "Invoice delivered but could not be locked", input.invoiceId, input.method, issueError.message);
      throw new Error("The customer delivery succeeded, but the invoice could not be finalized. Review the invoice before trying again.");
    }
  }

  const { data: sentInvoice, error: sentError } = await admin.from("invoices")
    .update({status:"sent",sent_at:sentAt.toISOString(),due_date:dueDate})
    .eq("id",input.invoiceId)
    .eq("status","issued")
    .is("sent_at",null)
    .select("id")
    .maybeSingle();
  if (sentError) throw sentError;
  if (!sentInvoice) throw new Error("The invoice changed while it was being sent. Review its status before trying again.");
  revalidatePath("/billing");
  revalidatePath(`/billing/${input.invoiceId}`);
  if (invoice.project_id) revalidatePath(`/projects/${invoice.project_id}`);
  logInvoiceDelivery("info", "Invoice delivered and locked", input.invoiceId, input.method);
  return { ok: true, results };
}
