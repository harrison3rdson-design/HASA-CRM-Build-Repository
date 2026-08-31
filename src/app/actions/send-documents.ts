"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createProposalShareLink, createAdditionalServiceShareLink } from "@/lib/public/share-links";
import { deliverPublicLink } from "@/lib/delivery/send-document";

function appUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not configured.");
  return url.replace(/\/$/, "");
}

export async function sendProposalAction(input: {
  proposalId: string;
  revisionId: string;
  method: "sms" | "email" | "both";
}) {
  await requireUser();
  const admin = createAdminClient();

  const { data: proposal, error } = await admin.from("proposals").select(`
    proposal_number,project_name,current_revision,status,primary_contact:contacts(first_name,last_name,email,mobile_phone)
  `).eq("id", input.proposalId).single();
  if (error) throw error;

  const { data: revision, error: revisionError } = await admin
    .from("proposal_revisions")
    .select("proposal_id,revision_number,locked")
    .eq("id", input.revisionId)
    .single();
  if (revisionError) throw revisionError;
  if (revision.proposal_id !== input.proposalId || revision.revision_number !== proposal.current_revision) {
    throw new Error("Only the current revision of this proposal can be sent.");
  }
  if (revision.locked) throw new Error("This proposal revision has already been sent and locked.");
  if (proposal.status !== "draft") throw new Error("Only a draft proposal can be sent.");

  const { token } = await createProposalShareLink(input.revisionId);
  const url = `${appUrl()}/public/proposals/${token}`;
  const c: any = proposal.primary_contact;

  const results = await deliverPublicLink({
    documentType: "proposal",
    relatedRecordId: input.proposalId,
    url,
    recipientName: [c?.first_name,c?.last_name].filter(Boolean).join(" "),
    email: c?.email,
    mobile: c?.mobile_phone,
    method: input.method,
    subject: `HASA Concepts Proposal ${proposal.proposal_number}`,
    message: `Please review proposal ${proposal.proposal_number} for ${proposal.project_name}.`,
  });

  const delivered = results.some((result) => result.status === "sent" || result.status === "delivered");
  if (!delivered) {
    throw new Error("The proposal was not delivered, so it remains editable and unlocked.");
  }

  const { data: lockedProposalId, error: lockError } = await admin.rpc("mark_proposal_revision_sent", {
    p_revision_id: input.revisionId,
  });
  if (lockError) throw lockError;
  if (lockedProposalId !== input.proposalId) throw new Error("The sent revision does not belong to this proposal.");

  revalidatePath("/proposals");
  revalidatePath(`/proposals/${input.proposalId}`);
  return { url, results };
}

export async function sendAdditionalServiceAction(input: {
  additionalServiceId: string;
  method: "sms" | "email" | "both";
}) {
  await requireUser();
  const admin = createAdminClient();

  const { data: a, error } = await admin.from("additional_services").select(`
    authorization_number,project:projects(project_name,primary_contact:contacts(first_name,last_name,email,mobile_phone))
  `).eq("id", input.additionalServiceId).single();
  if (error) throw error;

  const { token } = await createAdditionalServiceShareLink(input.additionalServiceId);
  const url = `${appUrl()}/public/additional-services/${token}`;
  const c: any = (a as any).project?.primary_contact;

  const results = await deliverPublicLink({
    documentType: "additional_service",
    relatedRecordId: input.additionalServiceId,
    url,
    recipientName: [c?.first_name,c?.last_name].filter(Boolean).join(" "),
    email: c?.email,
    mobile: c?.mobile_phone,
    method: input.method,
    subject: `HASA Concepts Additional Service ${a.authorization_number}`,
    message: `Please review additional service authorization ${a.authorization_number}.`,
  });

  await admin.from("additional_services").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", input.additionalServiceId);
  return { url, results };
}
