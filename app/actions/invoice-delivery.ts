"use server";

import { requireUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { generateInvoicePdf } from "@/lib/invoices/render";
import { deliverPublicLink } from "@/lib/delivery/send-document";
import { createSignedDocumentUrl } from "@/lib/storage/private-storage";

export async function generateAndSendInvoiceAction(input:{
  invoiceId:string;
  method:"sms"|"email"|"both";
}) {
  await requireUser();
  const admin=createAdminClient();

  const generated=await generateInvoicePdf(input.invoiceId);
  const signedUrl=await createSignedDocumentUrl(generated.path,60*60*24*7);

  const {data:invoice,error}=await admin.from("invoices").select(`
    invoice_number,client:clients(company_name),project:projects(primary_contact:contacts(first_name,last_name,email,mobile_phone))
  `).eq("id",input.invoiceId).single();
  if(error) throw error;

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

  await admin.from("generated_documents").insert({
    document_type:"invoice",
    related_record_id:input.invoiceId,
    storage_path:generated.path,
    original_filename:`${invoice.invoice_number}.pdf`,
    mime_type:"application/pdf",
    sha256_hash:generated.sha256,
    locked:true,
  });

  await admin.from("invoices").update({status:"sent",sent_at:new Date().toISOString()}).eq("id",input.invoiceId);
  return results;
}
