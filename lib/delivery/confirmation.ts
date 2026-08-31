import { createSignedDocumentUrl } from "@/lib/storage/private-storage";
import { deliverPublicLink } from "@/lib/delivery/send-document";

export async function sendExecutedConfirmation(input:{
  documentType:"proposal"|"additional_service";
  relatedRecordId:string;
  storagePath:string;
  signerName:string;
  signerEmail?:string|null;
  signerMobile?:string|null;
  reference:string;
}) {
  if(!input.signerEmail && !input.signerMobile) return [];

  const url=await createSignedDocumentUrl(input.storagePath,60*60*24*7);
  const method =
    input.signerEmail && input.signerMobile ? "both" :
    input.signerMobile ? "sms" : "email";

  return deliverPublicLink({
    documentType:input.documentType,
    relatedRecordId:input.relatedRecordId,
    url,
    recipientName:input.signerName,
    email:input.signerEmail,
    mobile:input.signerMobile,
    method,
    subject:`HASA Concepts Executed Document — ${input.reference}`,
    message:`Thank you. Your electronically accepted ${input.reference} is available here.`,
  });
}
