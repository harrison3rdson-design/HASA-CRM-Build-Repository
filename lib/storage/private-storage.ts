import { createAdminClient } from "@/lib/supabase-admin";

const DOCUMENTS_BUCKET = process.env.DOCUMENTS_BUCKET ?? "hasa-documents";
const RECEIPTS_BUCKET = process.env.RECEIPTS_BUCKET ?? "hasa-receipts";

export async function createSignedDocumentUrl(path: string, expiresIn = 900) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

export async function createSignedReceiptUrl(path: string, expiresIn = 900) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

export function receiptStoragePath(input: {
  clientId: string;
  projectId: string;
  expenseId: string;
  filename: string;
}) {
  return `clients/${input.clientId}/projects/${input.projectId}/expenses/${input.expenseId}/${input.filename}`;
}

export function documentStoragePath(input: {
  clientId: string;
  projectId: string;
  category: "proposals" | "invoices" | "additional-services" | "other";
  filename: string;
}) {
  return `clients/${input.clientId}/projects/${input.projectId}/${input.category}/${input.filename}`;
}
