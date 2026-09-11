import { NextResponse } from "next/server";
import { Policies } from "@/lib/auth/action-policy";
import { createAdminClient } from "@/lib/supabase-admin";
import { createSignedDocumentUrl } from "@/lib/storage/private-storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  await Policies.internalRead();
  const { documentId } = await context.params;
  const admin = createAdminClient();
  const { data: document, error } = await admin
    .from("generated_documents")
    .select("storage_path,document_type,locked")
    .eq("id", documentId)
    .eq("document_type", "executed_proposal")
    .eq("locked", true)
    .single();

  if (error || !document?.storage_path) {
    return NextResponse.json({ error: "The accepted proposal PDF was not found." }, { status: 404 });
  }

  const signedUrl = await createSignedDocumentUrl(document.storage_path, 5 * 60);
  return NextResponse.redirect(signedUrl);
}
