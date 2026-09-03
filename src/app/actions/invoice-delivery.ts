"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { generateInvoicePdf } from "@/lib/invoices/render";
import { deliverPublicLink } from "@/lib/delivery/send-document";
import { createSignedDocumentUrl } from "@/lib/storage/private-storage";
import { calculateInvoiceDueDate } from "@/lib/invoices/due-date";
import { isTransactionalEmailConfigured } from "@/lib/messaging/email";
import { isTwilioConfigured } from "@/lib/messaging/twilio";
import {
  normalizeRelatedContact,
  selectDefaultProposalContact,
} from "@/lib/proposal-contacts";

type DeliveryMethod = "sms" | "email" | "both";

type SendInvoiceResult =
  | { ok: true; results: Awaited<ReturnType<typeof deliverPublicLink>> }
  | { ok: false; error: string };

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

export async function generateAndSendInvoiceAction(input:{
  invoiceId:string;
  method:DeliveryMethod;
}): Promise<SendInvoiceResult> {
  await requireUser();
  const admin=createAdminClient();

  const {data:invoice,error}=await admin.from("invoices").select(`
    invoice_number,project_id,client_id,payment_terms,status,locked,issued_at,sent_at,
    client:clients(company_name),
    project:projects(id,client_id,primary_contact_id,primary_contact:contacts(id,first_name,last_name,email,mobile_phone,is_primary))
  `).eq("id",input.invoiceId).single();
  if(error) throw error;
  if (invoice.sent_at || invoice.status === "sent") throw new Error("This invoice has already been sent.");
  if (invoice.status !== "draft" && invoice.status !== "issued") {
    throw new Error("Only a draft or previously issued unsent invoice can be sent.");
  }

  const project = Array.isArray(invoice.project) ? invoice.project[0] : invoice.project;
  let contact = normalizeRelatedContact(project?.primary_contact);
  if (!contact && project?.client_id) {
    const { data: contacts, error: contactsError } = await admin
      .from("contacts")
      .select("id,first_name,last_name,email,mobile_phone,is_primary")
      .eq("client_id", project.client_id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (contactsError) throw contactsError;
    contact = selectDefaultProposalContact(contacts ?? []);

    if (contact) {
      const { error: assignError } = await admin
        .from("projects")
        .update({ primary_contact_id: contact.id })
        .eq("id", invoice.project_id)
        .is("primary_contact_id", null);
      if (assignError) throw assignError;
    }
  }

  if (!contact?.email && !contact?.mobile_phone) {
    return { ok: false, error: "Assign a project contact with an email address or mobile number before sending." };
  }
  if ((input.method === "email" || input.method === "both") && !contact.email) {
    return { ok: false, error: "The project contact does not have an email address." };
  }
  if ((input.method === "sms" || input.method === "both") && !contact.mobile_phone) {
    return { ok: false, error: "The project contact does not have a mobile number." };
  }

  const providerError = requestedProviderError(input.method);
  if (providerError) {
    logInvoiceDelivery("error", "Invoice delivery configuration is incomplete", input.invoiceId, input.method, providerError);
    return { ok: false, error: providerError };
  }

  const sentAt = new Date();
  const dueDate = calculateInvoiceDueDate(sentAt, invoice.payment_terms);
  let generated: Awaited<ReturnType<typeof generateInvoicePdf>>;
  let results: Awaited<ReturnType<typeof deliverPublicLink>>;
  try {
    generated=await generateInvoicePdf(input.invoiceId,{dueDate});
    const signedUrl=await createSignedDocumentUrl(generated.path,60*60*24*7);
    logInvoiceDelivery("info", "Invoice delivery started", input.invoiceId, input.method);
    results=await deliverPublicLink({
      documentType:"invoice",
      relatedRecordId:input.invoiceId,
      url:signedUrl,
      recipientName:[contact.first_name,contact.last_name].filter(Boolean).join(" "),
      email:contact.email,
      mobile:contact.mobile_phone,
      method:input.method,
      subject:`HASA Concepts Invoice ${invoice.invoice_number}`,
      message:`Invoice ${invoice.invoice_number} is available for review.`,
      idempotencyKey:`invoice-${input.invoiceId}`,
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "The invoice could not be delivered.";
    logInvoiceDelivery("error", "Invoice delivery failed before completion", input.invoiceId, input.method, message);
    return {
      ok: false,
      error: `${message} ${invoice.status === "draft"
        ? "The invoice remains editable and unlocked."
        : "The invoice remains issued and unsent."}`,
    };
  }

  const delivered = results.some((result) => result.status === "sent" || result.status === "delivered");
  if (!delivered) {
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
      error: `${message} Its due-date period has not started, and ${invoice.status === "draft"
        ? "the invoice remains editable and unlocked."
        : "the invoice remains issued and unsent."}`,
    };
  }

  if (invoice.status === "draft") {
    const { error: issueError } = await admin.rpc("issue_invoice", { p_invoice_id: input.invoiceId });
    if (issueError) {
      logInvoiceDelivery("error", "Invoice delivered but could not be locked", input.invoiceId, input.method, issueError.message);
      throw new Error("The customer delivery succeeded, but the invoice could not be finalized. Review the invoice before trying again.");
    }
  }

  const { error: documentError } = await admin.from("generated_documents").insert({
    document_type:"invoice",
    related_record_id:input.invoiceId,
    storage_path:generated.path,
    original_filename:`${invoice.invoice_number}.pdf`,
    mime_type:"application/pdf",
    sha256_hash:generated.sha256,
    locked:true,
  });
  if (documentError) throw documentError;

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
  revalidatePath(`/projects/${invoice.project_id}`);
  logInvoiceDelivery("info", "Invoice delivered and locked", input.invoiceId, input.method);
  return { ok: true, results };
}
