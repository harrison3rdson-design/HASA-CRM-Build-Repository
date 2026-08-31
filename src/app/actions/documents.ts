"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requiredText, optionalText } from "@/lib/validation/common";
import { documentStoragePath } from "@/lib/storage/private-storage";

export async function uploadDocumentAction(formData: FormData) {
  await requireUser();
  const admin = createAdminClient();

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Document file is required.");
  if (file.size > 25 * 1024 * 1024) throw new Error("Document exceeds 25 MB.");

  const clientId = requiredText(formData.get("client_id"), "Client");
  const projectId = requiredText(formData.get("project_id"), "Project");
  const documentType = requiredText(formData.get("document_type"), "Document type");
  const category =
    documentType === "proposal" ? "proposals" :
    documentType === "invoice" ? "invoices" :
    documentType === "additional_service" ? "additional-services" : "other";

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
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
  });

  if (error) throw error;
  revalidatePath("/documents");
}
