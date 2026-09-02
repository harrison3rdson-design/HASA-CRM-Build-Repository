import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { hashPublicToken } from "@/lib/security/tokens";
import { getPublicProposalByToken } from "@/lib/public/proposal";
import { executedProposalHtml } from "@/lib/documents/executed-html";
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

    const data = await getPublicProposalByToken(token);
    const pdf = await renderHtmlToPdf(executedProposalHtml(data, signer));
    const admin = createAdminClient();

    const path = `clients/${data.proposal.client?.id ?? "client"}/proposals/${data.proposal.proposal_number}/executed-R${data.revision.revision_number}-${crypto.randomUUID()}.pdf`;

    const { error: uploadError } = await admin.storage
      .from(process.env.DOCUMENTS_BUCKET ?? "hasa-documents")
      .upload(path, pdf.bytes, { contentType: "application/pdf", upsert: false });

    if (uploadError) throw uploadError;

    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? null;

    const { data: projectId, error } = await admin.rpc("finalize_proposal_acceptance", {
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
      documentType: "proposal",
      relatedRecordId: data.proposal.id,
      projectId: projectId ? String(projectId) : null,
      reference: `Proposal ${data.proposal.proposal_number}`,
      projectName: data.proposal.project_name,
      clientName: data.proposal.client?.company_name,
      signerName: String(signer.signerName).trim(),
      signerEmail: signer.signerEmail || null,
      signerMobile: signer.signerMobile || null,
    });

    if (notification.status === "failed") {
      console.error("[proposal-acceptance-notification] failed", {
        proposalId: data.proposal.id,
        error: notification.errorMessage,
      });
    }

    return NextResponse.json({ accepted: true, projectId });
  } catch (error) {
    console.error("[proposal-acceptance] failed", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "The proposal could not be accepted. Please try again or contact HASA Concepts." },
      { status: 500 }
    );
  }
}
