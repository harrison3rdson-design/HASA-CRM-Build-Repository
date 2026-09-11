import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { hashPublicToken } from "@/lib/security/tokens";
import { getPublicProposalByToken } from "@/lib/public/proposal";
import { executedProposalHtml } from "@/lib/documents/executed-html";
import { renderHtmlToPdf } from "@/lib/documents/playwright-pdf";
import { deliverAcceptedProposalPackage } from "@/lib/delivery/accepted-proposal-package";
import { calculateAlternateSelection } from "@/lib/proposal-alternates";
import {
  PublicRequestError,
  publicRequestErrorResponse,
  readPublicAcceptance,
  rejectCrossSiteSubmission,
  validatePublicToken,
} from "@/lib/security/public-request";

export const maxDuration = 60;

function filenamePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "Project";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    rejectCrossSiteSubmission(request);
    const { token: rawToken } = await context.params;
    const token = validatePublicToken(rawToken);
    const signer = await readPublicAcceptance(request);
    if (!signer.signerEmail) {
      throw new PublicRequestError(
        "Email is required so the completed contract can be delivered to you.",
        400,
      );
    }

    const data = await getPublicProposalByToken(token);
    let selection;
    try {
      selection = calculateAlternateSelection(
        data.alternates,
        signer.selectedAlternateKeys,
        data.revision.estimated_total,
      );
    } catch (error) {
      throw new PublicRequestError(
        error instanceof Error ? error.message : "The alternate selections are invalid.",
        400,
      );
    }

    const acceptanceClock = { acceptedAt: new Date().toISOString() };
    const acceptedAt = acceptanceClock.acceptedAt;
    const acceptanceId = crypto.randomUUID();
    const acceptanceVersionId = `${data.proposal.proposal_number}-R${data.revision.revision_number}-${acceptanceId.slice(0, 8).toUpperCase()}`;
    const projectSlug = filenamePart(data.proposal.project_name);
    const filename = `HASA_${data.proposal.proposal_number}_${projectSlug}_ACCEPTED_${acceptedAt.slice(0, 10)}_${acceptanceId.slice(0, 8)}.pdf`;
    const pdf = await renderHtmlToPdf(executedProposalHtml(data, signer, {
      acceptanceVersionId,
      acceptedAt,
      selection,
    }));
    const admin = createAdminClient();
    const path = `clients/${data.proposal.client?.id ?? "client"}/proposals/${data.proposal.proposal_number}/accepted/${acceptanceVersionId}/${filename}`;
    const bucket = process.env.DOCUMENTS_BUCKET ?? "hasa-documents";
    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(path, pdf.bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;

    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? null;
    const { data: finalization, error } = await admin.rpc("finalize_proposal_acceptance", {
      p_token_hash: hashPublicToken(token),
      p_acceptance_id: acceptanceId,
      p_acceptance_version_id: acceptanceVersionId,
      p_accepted_at: acceptedAt,
      p_selected_alternate_keys: selection.selectedKeys,
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
      p_original_filename: filename,
      p_file_size: pdf.bytes.length,
    });
    if (error || !finalization?.projectId) {
      await admin.storage.from(bucket).remove([path]);
      throw error ?? new Error("The proposal acceptance could not be finalized.");
    }

    let delivery = {
      emailedTo: [] as string[],
      deliveryWarning: null as string | null,
    };
    try {
      delivery = await deliverAcceptedProposalPackage({
        proposalId: data.proposal.id,
        clientId: data.proposal.client.id,
        projectId: String(finalization.projectId),
        proposalNumber: data.proposal.proposal_number,
        projectName: data.proposal.project_name,
        clientName: data.proposal.client?.company_name,
        signerName: signer.signerName,
        customerEmail: signer.signerEmail,
        acceptanceVersionId,
        acceptedTotal: Number(finalization.acceptedTotal),
        filename,
        pdfBytes: pdf.bytes,
      });
    } catch (deliveryError) {
      console.error("[accepted-proposal-delivery] failed", {
        proposalId: data.proposal.id,
        acceptanceVersionId,
        error: deliveryError instanceof Error ? deliveryError.message : String(deliveryError),
      });
      delivery.deliveryWarning = "Your approval is complete, but the contract emails could not be delivered automatically. HASA Concepts can resend the retained final PDF from the proposal record.";
    }

    return NextResponse.json({
      accepted: true,
      projectId: String(finalization.projectId),
      acceptedAt: String(finalization.acceptedAt ?? acceptedAt),
      acceptedTotal: Number(finalization.acceptedTotal),
      acceptanceVersionId,
      signerName: signer.signerName,
      reference: `Proposal ${data.proposal.proposal_number}`,
      emailedTo: delivery.emailedTo,
      deliveryWarning: delivery.deliveryWarning,
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
      { status: 500 },
    );
  }
}
