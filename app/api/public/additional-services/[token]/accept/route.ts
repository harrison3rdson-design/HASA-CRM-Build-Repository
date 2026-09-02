import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { hashPublicToken } from "@/lib/security/tokens";
import { getPublicAuthorizationByToken } from "@/lib/public/additional-service";
import { executedAuthorizationHtml } from "@/lib/documents/executed-html";
import { renderHtmlToPdf } from "@/lib/documents/playwright-pdf";
import { sendInternalAcceptanceNotification } from "@/lib/delivery/customer-action-notification";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const signer = await request.json();

    if (!String(signer.signerName ?? "").trim()) {
      return NextResponse.json({ error: "Signer name is required." }, { status: 400 });
    }

    const data = await getPublicAuthorizationByToken(token);
    const pdf = await renderHtmlToPdf(executedAuthorizationHtml(data, signer));
    const admin = createAdminClient();

    const a = data.authorization;
    const path = `projects/${a.project?.project_number ?? "project"}/additional-services/${a.authorization_number}/executed-${crypto.randomUUID()}.pdf`;

    const { error: uploadError } = await admin.storage
      .from(process.env.DOCUMENTS_BUCKET ?? "hasa-documents")
      .upload(path, pdf.bytes, { contentType: "application/pdf", upsert: false });

    if (uploadError) throw uploadError;

    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? null;

    const { data: projectId, error } = await admin.rpc("finalize_additional_service_acceptance", {
      p_token_hash: hashPublicToken(token),
      p_signer_name: signer.signerName,
      p_signer_title: signer.signerTitle || null,
      p_signer_email: signer.signerEmail || null,
      p_signer_mobile: signer.signerMobile || null,
      p_signature_type: signer.signatureType || "typed",
      p_acceptance_statement: signer.acceptanceStatement || "Accepted electronically.",
      p_ip_address: ip,
      p_user_agent: request.headers.get("user-agent"),
      p_executed_pdf_path: path,
      p_document_hash: pdf.sha256,
    });

    if (error) throw error;

    const notification = await sendInternalAcceptanceNotification({
      documentType: "additional_service",
      relatedRecordId: a.id,
      projectId: projectId ? String(projectId) : a.project_id,
      reference: `Authorization ${a.authorization_number}`,
      projectName: a.project?.project_name,
      clientName: a.project?.client?.company_name,
      signerName: String(signer.signerName).trim(),
      signerEmail: signer.signerEmail || null,
      signerMobile: signer.signerMobile || null,
    });

    if (notification.status === "failed") {
      console.error("[additional-service-acceptance-notification] failed", {
        authorizationId: a.id,
        error: notification.errorMessage,
      });
    }

    return NextResponse.json({
      accepted: true,
      projectId,
      acceptedAt: new Date().toISOString(),
      signerName: String(signer.signerName).trim(),
      reference: `Authorization ${a.authorization_number}`,
    });
  } catch (error) {
    console.error("[additional-service-acceptance] failed", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "The authorization could not be accepted. Please try again or contact HASA Concepts." },
      { status: 500 }
    );
  }
}
