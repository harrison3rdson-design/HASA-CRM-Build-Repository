"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requiredText, optionalText, numberValue } from "@/lib/validation/common";
import { parsePaymentTerms } from "@/lib/payment-terms";

export async function createProposalAction(formData: FormData) {
  const { supabase, authUser } = await requireUser();

  const proposalNumber = requiredText(formData.get("proposal_number"), "Proposal number");
  const clientId = requiredText(formData.get("client_id"), "Client");
  const projectName = requiredText(formData.get("project_name"), "Project name");
  let paymentTerms = optionalText(formData.get("payment_terms"));

  if (!paymentTerms) {
    const { data: settings, error: settingsError } = await supabase
      .from("company_settings")
      .select("default_payment_terms")
      .limit(1)
      .single();
    if (settingsError) throw settingsError;
    paymentTerms = settings.default_payment_terms;
  }

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .insert({
      proposal_number: proposalNumber,
      client_id: clientId,
      primary_contact_id: optionalText(formData.get("primary_contact_id")),
      project_name: projectName,
      project_location: optionalText(formData.get("project_location")),
      status: "draft",
      current_revision: 1,
    })
    .select("id")
    .single();

  if (proposalError) throw proposalError;

  const { data: userRecord } = await supabase
    .from("app_users")
    .select("id")
    .eq("auth_user_id", authUser.id)
    .single();

  const { data: revision, error: revisionError } = await supabase
    .from("proposal_revisions")
    .insert({
      proposal_id: proposal.id,
      revision_number: 1,
      professional_fee: numberValue(formData.get("professional_fee"), "Professional fee", { min: 0 }),
      estimated_expenses: numberValue(formData.get("estimated_expenses"), "Estimated expenses", { min: 0 }),
      payment_terms: parsePaymentTerms(paymentTerms),
      validity_days: numberValue(formData.get("validity_days"), "Validity days", { min: 1 }),
      billing_method: optionalText(formData.get("billing_method")),
      created_by: userRecord?.id ?? null,
    })
    .select("id")
    .single();

  if (revisionError) throw revisionError;

  revalidatePath("/proposals");
  redirect(`/proposals/${proposal.id}`);
}

export async function updateProposalRevisionPaymentTermsAction(formData: FormData) {
  await requireUser();
  const admin = createAdminClient();
  const revisionId = requiredText(formData.get("revision_id"), "Proposal revision");
  const paymentTerms = parsePaymentTerms(formData.get("payment_terms"));

  const { data: revision, error: readError } = await admin
    .from("proposal_revisions")
    .select("proposal_id,locked")
    .eq("id", revisionId)
    .single();

  if (readError) throw readError;
  if (revision.locked) throw new Error("Accepted proposal revision terms are locked and cannot be changed.");

  const { error: updateError } = await admin
    .from("proposal_revisions")
    .update({ payment_terms: paymentTerms })
    .eq("id", revisionId)
    .eq("locked", false);

  if (updateError) throw updateError;
  revalidatePath(`/proposals/${revision.proposal_id}`);
}

export async function createProposalRevisionAction(proposalId: string) {
  await requireUser();
  const admin = createAdminClient();

  const { data: current, error } = await admin
    .from("proposal_revisions")
    .select("*")
    .eq("proposal_id", proposalId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .single();

  if (error) throw error;

  const nextRevision = Number(current.revision_number) + 1;

  const { data: revision, error: insertError } = await admin
    .from("proposal_revisions")
    .insert({
      proposal_id: proposalId,
      revision_number: nextRevision,
      professional_fee: current.professional_fee,
      estimated_expenses: current.estimated_expenses,
      billing_method: current.billing_method,
      payment_terms: current.payment_terms,
      validity_days: current.validity_days,
      internal_notes: current.internal_notes,
      locked: false,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;

  const copyChildren = async (table: string, fk: string, excluded = ["id"]) => {
    const { data: rows, error: readError } = await admin.from(table).select("*").eq(fk, current.id);
    if (readError) throw readError;
    if (!rows?.length) return;
    const inserts = rows.map((row: any) => {
      const next: any = { ...row, [fk]: revision.id };
      excluded.forEach(k => delete next[k]);
      return next;
    });
    const { error: writeError } = await admin.from(table).insert(inserts);
    if (writeError) throw writeError;
  };

  await copyChildren("proposal_sections", "proposal_revision_id");
  await copyChildren("proposal_fee_items", "proposal_revision_id");
  await copyChildren("proposal_expense_estimates", "proposal_revision_id");

  await admin
    .from("proposals")
    .update({ current_revision: nextRevision, status: "draft" })
    .eq("id", proposalId);

  revalidatePath("/proposals");
  return revision.id as string;
}
