"use server";

import { requireUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { generateInvoicePdf } from "@/lib/invoices/render";
import { deliverPublicLink } from "@/lib/delivery/send-document";
import { createSignedDocumentUrl } from "@/lib/storage/private-storage";
import { calculateInvoiceDueDate } from "@/lib/invoices/due-date";

export async function generateAndSendInvoiceAction(input:{
  invoiceId:string;
  method:"sms"|"email"|"both";
}) {
  await requireUser();
  const admin=createAdminClient();

  const {data:invoice,error}=await admin.from("invoices").select(`
    invoice_number,payment_terms,status,sent_at,client:clients(company_name),project:projects(primary_contact:contacts(first_name,last_name,email,mobile_phone))
  `).eq("id",input.invoiceId).single();
  if(error) throw error;
  if (invoice.sent_at || invoice.status === "sent") throw new Error("This invoice has already been sent.");
  if (invoice.status !== "issued") throw new Error("Issue the invoice before sending it to the customer.");

  const sentAt = new Date();
  const dueDate = calculateInvoiceDueDate(sentAt, invoice.payment_terms);
  const generated=await generateInvoicePdf(input.invoiceId,{dueDate});
  const signedUrl=await createSignedDocumentUrl(generated.path,60*60*24*7);

  const c:any=(invoice as any).project?.primary_contact;
  const results=await deliverPublicLink({
    documentType:"invoice",
    relatedRecordId:input.invoiceId,
    url:signedUrl,
    recipientName:[c?.first_name,c?.last_name].filter(Boolean).join(" "),
    email:c?.email,
    mobile:c?.mobile_phone,
    method:input.method,
    subject:`HASA Concepts Invoice ${invoice.invoice_number}`,
    message:`Invoice ${invoice.invoice_number} is available for review.`,
  });

  const delivered = results.some((result) => result.status === "sent" || result.status === "delivered");
  if (!delivered) {
    const providerMessages = results
      .filter((result) => result.status === "failed")
      .map((result) => result.errorMessage)
      .filter(Boolean);
    throw new Error(providerMessages.length
      ? providerMessages.join(" ")
      : "The invoice was not delivered, so its due-date period has not started.");
  }

  await admin.from("generated_documents").insert({
    document_type:"invoice",
    related_record_id:input.invoiceId,
    storage_path:generated.path,
    original_filename:`${invoice.invoice_number}.pdf`,
    mime_type:"application/pdf",
    sha256_hash:generated.sha256,
    locked:true,
  });

  const { data: sentInvoice, error: sentError } = await admin.from("invoices")
    .update({status:"sent",sent_at:sentAt.toISOString(),due_date:dueDate})
    .eq("id",input.invoiceId)
    .eq("status","issued")
    .is("sent_at",null)
    .select("id")
    .maybeSingle();
  if (sentError) throw sentError;
  if (!sentInvoice) throw new Error("The invoice changed while it was being sent. Review its status before trying again.");
  return results;
}
