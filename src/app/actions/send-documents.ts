"use server";

import { revalidatePath } from "next/cache";
import { Policies } from "@/lib/auth/action-policy";
import { createAdminClient } from "@/lib/supabase-admin";
import { createProposalShareLink, createAdditionalServiceShareLink } from "@/lib/public/share-links";
import { deliverPublicLink } from "@/lib/delivery/send-document";
import { normalizeRelatedContact, selectDefaultProposalContact } from "@/lib/proposal-contacts";
import { resolveAppUrl } from "@/lib/app-url";
import { isTwilioConfigured } from "@/lib/messaging/twilio";
import { isTransactionalEmailConfigured } from "@/lib/messaging/email";

type SendDocumentResult =
  | { ok: true; url: string; results: Awaited<ReturnType<typeof deliverPublicLink>> }
  | { ok: false; error: string };

function requestedProviderError(method: "sms" | "email" | "both"): string | null {
  const errors: string[] = [];
  if ((method === "sms" || method === "both") && !isTwilioConfigured()) {
    errors.push("Text messaging is not configured for this app. Add the HASA Twilio account settings before sending.");
  }
  if ((method === "email" || method === "both") && !isTransactionalEmailConfigured()) {
    errors.push("Email delivery is not configured for this app.");
  }
  return errors.length ? errors.join(" ") : null;
}

function logDeliveryFailure(proposalId: string, method: string, error: string) {
  console.error(JSON.stringify({
    level: "error",
    message: "Proposal delivery failed",
    proposalId,
    method,
    error,
  }));
}

export async function sendProposalAction(input: {
  proposalId: string;
  revisionId: string;
  method: "sms" | "email" | "both";
}): Promise<SendDocumentResult> {
  await Policies.proposalSend();
  const admin = createAdminClient();

  const { data: proposal, error } = await admin.from("proposals").select(`
    proposal_number,project_name,client_id,current_revision,status,primary_contact:contacts(id,first_name,last_name,email,mobile_phone,is_primary)
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
  const isInitialSend = proposal.status === "draft" && !revision.locked;
  const isResend = revision.locked && ["sent", "viewed", "changes_requested"].includes(proposal.status);
  if (!isInitialSend && !isResend) {
    throw new Error("Only an unsent draft or a sent proposal awaiting authorization can be delivered.");
  }

  let contact = normalizeRelatedContact(proposal.primary_contact);
  if (!contact) {
    const { data: contacts, error: contactsError } = await admin
      .from("contacts")
      .select("id,first_name,last_name,email,mobile_phone,is_primary")
      .eq("client_id", proposal.client_id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (contactsError) throw contactsError;

    contact = selectDefaultProposalContact(contacts ?? []);
    if (contact) {
      const { error: assignError } = await admin
        .from("proposals")
        .update({ primary_contact_id: contact.id })
        .eq("id", input.proposalId)
        .is("primary_contact_id", null);
      if (assignError) throw assignError;
    }
  }

  if (!contact?.email && !contact?.mobile_phone) {
    throw new Error("Assign a Primary Contact with an email address or mobile number before sending.");
  }
  if ((input.method === "email" || input.method === "both") && !contact.email) {
    return { ok: false, error: "The proposal contact does not have an email address." };
  }
  if ((input.method === "sms" || input.method === "both") && !contact.mobile_phone) {
    return { ok: false, error: "The proposal contact does not have a mobile number." };
  }

  const providerError = requestedProviderError(input.method);
  if (providerError) {
    logDeliveryFailure(input.proposalId, input.method, providerError);
    return { ok: false, error: providerError };
  }

  let appUrl: string;
  try {
    appUrl = resolveAppUrl();
  } catch (error) {
    const message = error instanceof Error ? error.message : "The customer link could not be created.";
    logDeliveryFailure(input.proposalId, input.method, message);
    return { ok: false, error: message };
  }

  const { token, tokenHash } = await createProposalShareLink(
    input.revisionId,
    15,
    { revokeExisting: !isResend },
  );
  const url = `${appUrl}/public/proposals/${token}`;

  let results: Awaited<ReturnType<typeof deliverPublicLink>>;
  try {
    results = await deliverPublicLink({
      documentType: "proposal",
      relatedRecordId: input.proposalId,
      url,
      recipientName: [contact.first_name,contact.last_name].filter(Boolean).join(" "),
      email: contact.email,
      mobile: contact.mobile_phone,
      method: input.method,
      subject: `HASA Concepts Proposal ${proposal.proposal_number}`,
      message: `${isResend ? "A new review link is available for" : "Please review"} proposal ${proposal.proposal_number} for ${proposal.project_name}.`,
      idempotencyKey: `proposal-${input.proposalId}-${tokenHash}`,
    });
  } catch (error) {
    await admin.from("proposal_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", tokenHash)
      .is("revoked_at", null);
    const message = error instanceof Error
      ? error.message
      : isResend
        ? "The delivery provider could not be reached. The previous customer link remains available."
        : "The delivery provider could not be reached. The proposal remains editable and unlocked.";
    logDeliveryFailure(input.proposalId, input.method, message);
    return { ok: false, error: message };
  }

  const delivered = results.some((result) => result.status === "sent" || result.status === "delivered");
  if (!delivered) {
    await admin.from("proposal_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", tokenHash)
      .is("revoked_at", null);
    const providerMessages = results
      .filter((result) => result.status === "failed")
      .map((result) => result.errorMessage)
      .filter(Boolean);
    const fallback = isResend
      ? "The new message was not delivered. The previous customer link remains available."
      : "The proposal was not delivered, so it remains editable and unlocked.";
    const message = providerMessages.length
      ? `${providerMessages.join(" ")} ${fallback}`
      : fallback;
    logDeliveryFailure(input.proposalId, input.method, message);
    return { ok: false, error: message };
  }

  const { data: lockedProposalId, error: lockError } = await admin.rpc("mark_proposal_revision_sent", {
    p_revision_id: input.revisionId,
  });
  if (lockError) throw lockError;
  if (lockedProposalId !== input.proposalId) throw new Error("The sent revision does not belong to this proposal.");

  if (isResend) {
    await admin.from("proposal_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("proposal_revision_id", input.revisionId)
      .neq("token_hash", tokenHash)
      .is("revoked_at", null);
  }

  revalidatePath("/proposals");
  revalidatePath(`/proposals/${input.proposalId}`);
  return { ok: true, url, results };
}

export async function sendAdditionalServiceAction(input: {
  additionalServiceId: string;
  method: "sms" | "email" | "both";
}): Promise<SendDocumentResult> {
  await Policies.projectWrite();
  const admin = createAdminClient();

  const { data: a, error } = await admin.from("additional_services").select(`
    authorization_number,project_id,status,locked,
    project:projects(id,project_name,client_id,primary_contact:contacts(id,first_name,last_name,email,mobile_phone,is_primary))
  `).eq("id", input.additionalServiceId).single();
  if (error) throw error;
  if (a.locked || a.status !== "draft") {
    throw new Error("Only an unlocked draft authorization can be sent.");
  }

  const project = Array.isArray(a.project) ? a.project[0] : a.project;
  let contact = normalizeRelatedContact(project?.primary_contact);
  if (!contact && project?.client_id) {
    const { data: contacts, error: contactsError } = await admin
      .from("contacts")
      .select("id,first_name,last_name,email,mobile_phone,is_primary")
      .eq("client_id", project.client_id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (contactsError) throw contactsError;

    contact = selectDefaultProposalContact(contacts ?? []);
    if (contact) {
      const { error: assignError } = await admin
        .from("projects")
        .update({ primary_contact_id: contact.id })
        .eq("id", a.project_id)
        .is("primary_contact_id", null);
      if (assignError) throw assignError;
    }
  }

  if (!contact?.email && !contact?.mobile_phone) {
    return { ok: false, error: "Assign a project contact with an email address or mobile number before sending." };
  }
  if ((input.method === "email" || input.method === "both") && !contact.email) {
    return { ok: false, error: "The project contact does not have an email address." };
  }
  if ((input.method === "sms" || input.method === "both") && !contact.mobile_phone) {
    return { ok: false, error: "The project contact does not have a mobile number." };
  }

  const providerError = requestedProviderError(input.method);
  if (providerError) {
    logDeliveryFailure(input.additionalServiceId, input.method, providerError);
    return { ok: false, error: providerError };
  }

  let appUrl: string;
  try {
    appUrl = resolveAppUrl();
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "The customer link could not be created.";
    logDeliveryFailure(input.additionalServiceId, input.method, message);
    return { ok: false, error: message };
  }

  const { token } = await createAdditionalServiceShareLink(input.additionalServiceId);
  const url = `${appUrl}/public/additional-services/${token}`;

  let results: Awaited<ReturnType<typeof deliverPublicLink>>;
  try {
    results = await deliverPublicLink({
      documentType: "additional_service",
      relatedRecordId: input.additionalServiceId,
      url,
      recipientName: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
      email: contact.email,
      mobile: contact.mobile_phone,
      method: input.method,
      subject: `HASA Concepts Additional Service ${a.authorization_number}`,
      message: `Please review additional service authorization ${a.authorization_number} for ${project?.project_name ?? "your project"}.`,
    });
  } catch (caught) {
    await admin.from("additional_service_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("additional_service_id", input.additionalServiceId)
      .is("revoked_at", null);
    const message = caught instanceof Error
      ? caught.message
      : "The delivery provider could not be reached. The authorization remains editable and unlocked.";
    logDeliveryFailure(input.additionalServiceId, input.method, message);
    return { ok: false, error: message };
  }

  const delivered = results.some((result) => result.status === "sent" || result.status === "delivered");
  if (!delivered) {
    await admin.from("additional_service_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("additional_service_id", input.additionalServiceId)
      .is("revoked_at", null);
    const providerMessages = results
      .filter((result) => result.status === "failed")
      .map((result) => result.errorMessage)
      .filter(Boolean);
    const message = providerMessages.length
      ? `${providerMessages.join(" ")} The authorization remains editable and unlocked.`
      : "The authorization was not delivered, so it remains editable and unlocked.";
    logDeliveryFailure(input.additionalServiceId, input.method, message);
    return { ok: false, error: message };
  }

  const { data: locked, error: lockError } = await admin.from("additional_services")
    .update({ status: "sent", sent_at: new Date().toISOString(), locked: true })
    .eq("id", input.additionalServiceId)
    .eq("status", "draft")
    .eq("locked", false)
    .select("id")
    .maybeSingle();
  if (lockError) throw lockError;
  if (!locked) throw new Error("The authorization changed while it was being sent. Review its status before trying again.");

  revalidatePath(`/projects/${a.project_id}`);
  revalidatePath(`/additional-services/${input.additionalServiceId}`);
  return { ok: true, url, results };
}
