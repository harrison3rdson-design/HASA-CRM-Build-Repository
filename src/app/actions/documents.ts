"use server";

import { revalidatePath } from "next/cache";
import { Policies } from "@/lib/auth/action-policy";
import { createAdminClient } from "@/lib/supabase-admin";
import { requiredText, optionalText } from "@/lib/validation/common";
import { documentStoragePath } from "@/lib/storage/private-storage";
import { requiredUuid, safeOriginalFilename, validateUploadedFile } from "@/lib/security/uploads";

const DOCUMENT_TYPES = new Set(["proposal", "invoice", "additional_service", "other"]);

export async function uploadDocumentAction(formData: FormData) {
  const { appUser } = await Policies.documentWrite();
  const admin = createAdminClient();

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Document file is required.");
  await validateUploadedFile(file, "Document", 10 * 1024 * 1024);

  const clientId = requiredUuid(formData.get("client_id"), "Client");
  const projectId = requiredUuid(formData.get("project_id"), "Project");
  const documentType = requiredText(formData.get("document_type"), "Document type");
  if (!DOCUMENT_TYPES.has(documentType)) throw new Error("Document type is invalid.");

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) throw new Error("The selected project does not belong to this client.");

  const category =
    documentType === "proposal" ? "proposals" :
    documentType === "invoice" ? "invoices" :
    documentType === "additional_service" ? "additional-services" : "other";

  const safeName = safeOriginalFilename(file.name);
  const path = documentStoragePath({
    clientId,
    projectId,
    category,
    filename: `${crypto.randomUUID()}-${safeName}`,
  });

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: storageError } = await admin.storage
    .from(process.env.DOCUMENTS_BUCKET ?? "hasa-documents")
    .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });

  if (storageError) throw storageError;

  const { error } = await admin.from("documents").insert({
    client_id: clientId,
    project_id: projectId,
    document_type: documentType,
    document_subtype: optionalText(formData.get("document_subtype")),
    title: requiredText(formData.get("title"), "Title"),
    storage_path: path,
    original_filename: file.name,
    mime_type: file.type || null,
    file_size: file.size,
    document_date: optionalText(formData.get("document_date")),
    uploaded_by: appUser.id,
  });

  if (error) {
    await admin.storage.from(process.env.DOCUMENTS_BUCKET ?? "hasa-documents").remove([path]);
    throw error;
  }
  revalidatePath("/documents");
}
