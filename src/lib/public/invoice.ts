import { createAdminClient } from "@/lib/supabase-admin";
import { generateSecureToken, hashPublicToken } from "@/lib/security/tokens";
import { validatePublicToken } from "@/lib/security/public-request";
import { invoiceLinkExpiresAt } from "@/lib/public/invoice-link-policy";

export type InvoiceLinkFailureReason = "invalid" | "expired" | "unavailable";

type InvoiceLinkResolution =
  | {
      ok: true;
      storagePath: string;
      originalFilename: string;
    }
  | {
      ok: false;
      reason: InvoiceLinkFailureReason;
    };

export async function createInvoiceShareLink(input: {
  invoiceId: string;
  documentId: string;
}) {
  const admin = createAdminClient();
  const token = generateSecureToken();
  const tokenHash = hashPublicToken(token);
  const expiresAt = invoiceLinkExpiresAt();

  const { error } = await admin.from("invoice_share_links").insert({
    invoice_id: input.invoiceId,
    document_id: input.documentId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (error) throw error;

  return { token, tokenHash, expiresAt };
}

export async function activateInvoiceShareLink(invoiceId: string, tokenHash: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("invoice_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("invoice_id", invoiceId)
    .neq("token_hash", tokenHash)
    .is("revoked_at", null);
  if (error) throw error;
}

export async function revokeInvoiceShareLink(tokenHash: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("invoice_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .is("revoked_at", null);
  if (error) throw error;
}

export async function resolveInvoiceShareLink(rawToken: string): Promise<InvoiceLinkResolution> {
  let token: string;
  try {
    token = validatePublicToken(rawToken);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const admin = createAdminClient();
  const tokenHash = hashPublicToken(token);
  const { data: link, error: linkError } = await admin
    .from("invoice_share_links")
    .select("document_id,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError || !link || link.revoked_at) {
    return { ok: false, reason: "invalid" };
  }
  if (new Date(link.expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const { data: document, error: documentError } = await admin
    .from("generated_documents")
    .select("storage_path,original_filename")
    .eq("id", link.document_id)
    .eq("document_type", "invoice")
    .eq("locked", true)
    .maybeSingle();

  if (documentError || !document) {
    return { ok: false, reason: "unavailable" };
  }

  return {
    ok: true,
    storagePath: document.storage_path,
    originalFilename: document.original_filename,
  };
}
