import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { hashPublicToken } from "@/lib/security/tokens";
import { getPublicProposalByToken } from "@/lib/public/proposal";
import { executedProposalHtml } from "@/lib/documents/executed-html";
import { renderHtmlToPdf } from "@/lib/documents/playwright-pdf";
import { sendInternalAcceptanceNotification } from "@/lib/delivery/customer-action-notification";
import {
  publicRequestErrorResponse,
  readPublicAcceptance,
  validatePublicToken,
} from "@/lib/security/public-request";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await context.params;
    const token = validatePublicToken(rawToken);
    const signer = await readPublicAcceptance(request);

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
      p_signer_title: signer.signerTitle,
      p_signer_email: signer.signerEmail,
      p_signer_mobile: signer.signerMobile,
      p_signature_type: signer.signatureType,
      p_acceptance_statement: signer.acceptanceStatement,
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
      signerName: signer.signerName,
      signerEmail: signer.signerEmail,
      signerMobile: signer.signerMobile,
    });
    if (notification.status === "failed") {
      console.error("[proposal-acceptance-notification] failed", {
        proposalId: data.proposal.id,
        error: notification.errorMessage,
      });
    }

    return NextResponse.json({
      accepted: true,
      projectId,
      acceptedAt: new Date().toISOString(),
      signerName: signer.signerName,
      reference: `Proposal ${data.proposal.proposal_number}`,
    });
  } catch (error) {
    const requestError = publicRequestErrorResponse(error);
    if (requestError) return requestError;
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
