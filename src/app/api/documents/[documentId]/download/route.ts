import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createSignedDocumentUrl } from "@/lib/storage/private-storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  await requireUser();
  const { documentId } = await context.params;
  const admin = createAdminClient();
  const { data: document, error } = await admin
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();

  if (error || !document?.storage_path) {
    return NextResponse.json({ error: "Authorization evidence was not found." }, { status: 404 });
  }

  const signedUrl = await createSignedDocumentUrl(document.storage_path, 5 * 60);
  return NextResponse.redirect(signedUrl);
}
