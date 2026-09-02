"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requiredText, optionalText, numberValue, boolValue } from "@/lib/validation/common";
import { parsePaymentTerms } from "@/lib/payment-terms";
import {
  calculateExpenseAmount,
  calculateLaborAmount,
  parseExpenseBillingRule,
  roundMoney,
} from "@/lib/proposal-items";
import { parseProposalSectionType } from "@/lib/proposal-sections";
import { selectDefaultProposalContact } from "@/lib/proposal-contacts";
import { roundHoursUp } from "@/lib/time-increments";

export type CreateProposalActionState = {
  status: "idle" | "error";
  message: string;
};

function validationErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Review the proposal details and try again.";
}

function itemCount(value: FormDataEntryValue | null, label: string): number {
  const count = numberValue(value, label, { min: 0, max: 50 });
  if (!Number.isInteger(count)) throw new Error(`${label} must be a whole number.`);
  return count;
}

function parseProposalItems(formData: FormData) {
  const feeItems = [] as Array<{
    description: string;
    billing_type: "hourly";
    quantity: number;
    rate: number;
    amount: number;
    sort_order: number;
  }>;
  const expenseItems = [] as Array<{
    category: string;
    description: string | null;
    estimated_quantity: number;
    unit: string | null;
    estimated_rate: number;
    estimated_amount: number;
    billing_rule: ReturnType<typeof parseExpenseBillingRule>;
    markup_percent: number;
    requires_receipt: boolean;
    sort_order: number;
  }>;

  const laborCount = itemCount(formData.get("labor_count"), "Labor line count");
  for (let index = 0; index < laborCount; index += 1) {
    const description = optionalText(formData.get(`labor_description_${index}`));
    const hoursText = optionalText(formData.get(`labor_hours_${index}`));
    const rateText = optionalText(formData.get(`labor_rate_${index}`));
    if (!description && !hoursText && !rateText) continue;

    const hours = roundHoursUp(numberValue(hoursText, `Labor line ${index + 1} hours`, { min: 0 }));
    const rate = numberValue(rateText, `Labor line ${index + 1} hourly rate`, { min: 0 });
    feeItems.push({
      description: requiredText(description, `Labor line ${index + 1} description`),
      billing_type: "hourly",
      quantity: hours,
      rate,
      amount: calculateLaborAmount(hours, rate),
      sort_order: index,
    });
  }

  const expenseCount = itemCount(formData.get("expense_count"), "Expense line count");
  for (let index = 0; index < expenseCount; index += 1) {
    const category = optionalText(formData.get(`expense_category_${index}`));
    const description = optionalText(formData.get(`expense_description_${index}`));
    const quantityText = optionalText(formData.get(`expense_quantity_${index}`));
    const unit = optionalText(formData.get(`expense_unit_${index}`));
    const rateText = optionalText(formData.get(`expense_rate_${index}`));
    const markupText = optionalText(formData.get(`expense_markup_${index}`));
    const quantityChanged = quantityText !== null && quantityText !== "1";
    const hasMarkup = markupText !== null && Number(markupText) !== 0;
    if (!category && !description && !unit && !rateText && !quantityChanged && !hasMarkup) continue;

    const quantity = numberValue(quantityText ?? "1", `Expense line ${index + 1} quantity`, { min: 0 });
    const rate = numberValue(rateText ?? "0", `Expense line ${index + 1} unit cost`, { min: 0 });
    const markupPercent = numberValue(markupText ?? "0", `Expense line ${index + 1} markup`, { min: 0, max: 999.999 });
    const billingRule = parseExpenseBillingRule(formData.get(`expense_billing_rule_${index}`));
    expenseItems.push({
      category: requiredText(category, `Expense line ${index + 1} category`),
      description,
      estimated_quantity: quantity,
      unit,
      estimated_rate: rate,
      estimated_amount: calculateExpenseAmount(quantity, rate, markupPercent, billingRule),
      billing_rule: billingRule,
      markup_percent: billingRule === "actual_plus_markup" ? markupPercent : 0,
      requires_receipt: boolValue(formData.get(`expense_requires_receipt_${index}`)),
      sort_order: index,
    });
  }

  return {
    feeItems,
    expenseItems,
    professionalFee: roundMoney(feeItems.reduce((sum, item) => sum + item.amount, 0)),
    estimatedExpenses: roundMoney(expenseItems.reduce((sum, item) => sum + item.estimated_amount, 0)),
  };
}

function parseProposalSections(formData: FormData) {
  const sections = [] as Array<{
    section_type: ReturnType<typeof parseProposalSectionType>;
    heading: string | null;
    content: string;
    sort_order: number;
  }>;
  const scopeCount = itemCount(formData.get("scope_count"), "Scope section count");

  for (let index = 0; index < scopeCount; index += 1) {
    const heading = optionalText(formData.get(`scope_heading_${index}`));
    const content = optionalText(formData.get(`scope_content_${index}`));
    if (!heading && !content) continue;

    sections.push({
      section_type: parseProposalSectionType(formData.get(`scope_type_${index}`)),
      heading,
      content: requiredText(content, `Scope section ${index + 1} content`),
      sort_order: index,
    });
  }

  return sections;
}

export async function createProposalAction(
  _previousState: CreateProposalActionState,
  formData: FormData,
): Promise<CreateProposalActionState> {
  const { supabase, authUser } = await requireUser();

  let proposalInput: {
    clientId: string;
    projectName: string;
    requestedContactId: string | null;
    scopeSections: ReturnType<typeof parseProposalSections>;
    items: ReturnType<typeof parseProposalItems>;
    paymentTerms: string | null;
    validityDays: number;
    billingMethod: string | null;
  };

  try {
    proposalInput = {
      clientId: requiredText(formData.get("client_id"), "Client"),
      projectName: requiredText(formData.get("project_name"), "Project name"),
      requestedContactId: optionalText(formData.get("primary_contact_id")),
      scopeSections: parseProposalSections(formData),
      items: parseProposalItems(formData),
      paymentTerms: optionalText(formData.get("payment_terms")),
      validityDays: numberValue(formData.get("validity_days"), "Validity days", { min: 1 }),
      billingMethod: optionalText(formData.get("billing_method")),
    };
  } catch (error) {
    return { status: "error", message: validationErrorMessage(error) };
  }

  const {
    clientId,
    projectName,
    requestedContactId,
    scopeSections,
    items: { feeItems, expenseItems, professionalFee, estimatedExpenses },
    validityDays,
    billingMethod,
  } = proposalInput;
  let { paymentTerms } = proposalInput;

  const { data: clientContacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id,is_primary")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (contactsError) throw contactsError;

  const requestedContact = requestedContactId
    ? clientContacts?.find((contact) => contact.id === requestedContactId)
    : null;
  if (requestedContactId && !requestedContact) {
    throw new Error("The selected Primary Contact does not belong to this Client.");
  }
  const primaryContactId = requestedContact?.id
    ?? selectDefaultProposalContact(clientContacts ?? [])?.id
    ?? null;

  if (!paymentTerms) {
    const { data: settings, error: settingsError } = await supabase
      .from("company_settings")
      .select("default_payment_terms")
      .limit(1)
      .single();
    if (settingsError) throw settingsError;
    paymentTerms = settings.default_payment_terms;
  }

  let parsedPaymentTerms: ReturnType<typeof parsePaymentTerms>;
  try {
    parsedPaymentTerms = parsePaymentTerms(paymentTerms);
  } catch (error) {
    return { status: "error", message: validationErrorMessage(error) };
  }

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .insert({
      client_id: clientId,
      primary_contact_id: primaryContactId,
      project_name: projectName,
      project_location: optionalText(formData.get("project_location")),
      status: "draft",
      current_revision: 1,
    })
    .select("id,proposal_number")
    .single();

  if (proposalError) throw proposalError;

  const discardIncompleteProposal = async () => {
    await supabase.from("proposals").delete().eq("id", proposal.id);
  };

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
      professional_fee: professionalFee,
      estimated_expenses: estimatedExpenses,
      payment_terms: parsedPaymentTerms,
      validity_days: validityDays,
      billing_method: billingMethod,
      created_by: userRecord?.id ?? null,
    })
    .select("id")
    .single();

  if (revisionError) {
    await discardIncompleteProposal();
    throw revisionError;
  }

  if (scopeSections.length) {
    const { error: scopeError } = await supabase
      .from("proposal_sections")
      .insert(scopeSections.map((section) => ({
        ...section,
        proposal_revision_id: revision.id,
      })));
    if (scopeError) {
      await discardIncompleteProposal();
      throw scopeError;
    }
  }

  if (feeItems.length) {
    const { error: feeError } = await supabase
      .from("proposal_fee_items")
      .insert(feeItems.map((item) => ({ ...item, proposal_revision_id: revision.id })));
    if (feeError) {
      await discardIncompleteProposal();
      throw feeError;
    }
  }

  if (expenseItems.length) {
    const { error: expenseError } = await supabase
      .from("proposal_expense_estimates")
      .insert(expenseItems.map((item) => ({ ...item, proposal_revision_id: revision.id })));
    if (expenseError) {
      await discardIncompleteProposal();
      throw expenseError;
    }
  }

  revalidatePath("/proposals");
  redirect(`/proposals/${proposal.id}`);
}

export async function updateProposalPrimaryContactAction(formData: FormData) {
  await requireUser();
  const admin = createAdminClient();
  const proposalId = requiredText(formData.get("proposal_id"), "Proposal");
  const contactId = requiredText(formData.get("primary_contact_id"), "Primary Contact");

  const { data: proposal, error: proposalError } = await admin
    .from("proposals")
    .select("id,client_id,current_revision,status")
    .eq("id", proposalId)
    .single();
  if (proposalError) throw proposalError;
  if (proposal.status !== "draft") throw new Error("Only a draft proposal can change its Primary Contact.");

  const [
    { data: contact, error: contactError },
    { data: revision, error: revisionError },
  ] = await Promise.all([
    admin.from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("client_id", proposal.client_id)
      .maybeSingle(),
    admin.from("proposal_revisions")
      .select("locked")
      .eq("proposal_id", proposalId)
      .eq("revision_number", proposal.current_revision)
      .single(),
  ]);

  if (contactError) throw contactError;
  if (!contact) throw new Error("The selected Primary Contact does not belong to this Client.");
  if (revisionError) throw revisionError;
  if (revision.locked) throw new Error("A sent proposal is locked and its Primary Contact cannot be changed.");

  const { data: updatedProposal, error: updateError } = await admin
    .from("proposals")
    .update({ primary_contact_id: contact.id })
    .eq("id", proposalId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updatedProposal) throw new Error("The proposal changed before the Primary Contact could be saved.");

  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
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
  if (revision.locked) throw new Error("Sent or accepted proposal revisions are locked and cannot be changed.");

  const { error: updateError } = await admin
    .from("proposal_revisions")
    .update({ payment_terms: paymentTerms })
    .eq("id", revisionId)
    .eq("locked", false);

  if (updateError) throw updateError;
  revalidatePath(`/proposals/${revision.proposal_id}`);
}

export async function updateProposalRevisionAction(formData: FormData) {
  await requireUser();
  const admin = createAdminClient();
  const revisionId = requiredText(formData.get("revision_id"), "Proposal revision");
  const paymentTerms = parsePaymentTerms(formData.get("payment_terms"));
  const validityDays = numberValue(formData.get("validity_days"), "Validity days", { min: 1 });
  const billingMethod = optionalText(formData.get("billing_method")) ?? "fixed_fee";
  const scopeSections = parseProposalSections(formData);
  const { feeItems, expenseItems } = parseProposalItems(formData);

  const { data: proposalId, error } = await admin.rpc("update_proposal_revision_draft_v2", {
    p_revision_id: revisionId,
    p_payment_terms: paymentTerms,
    p_validity_days: validityDays,
    p_billing_method: billingMethod,
    p_sections: scopeSections,
    p_fee_items: feeItems,
    p_expense_items: expenseItems,
  });

  if (error) throw error;
  if (!proposalId) throw new Error("The proposal revision could not be saved.");

  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
  redirect(`/proposals/${proposalId}`);
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
  revalidatePath(`/proposals/${proposalId}`);
  return revision.id as string;
}

export async function deleteLatestProposalRevisionAction(proposalId: string) {
  await requireUser();
  const admin = createAdminClient();

  const { data: currentRevision, error } = await admin.rpc(
    "delete_latest_unlocked_proposal_revision",
    { p_proposal_id: proposalId }
  );

  if (error) throw error;
  if (!Number.isInteger(currentRevision)) {
    throw new Error("The proposal revision could not be deleted.");
  }

  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
  return currentRevision as number;
}

export async function deleteUnissuedDraftProposalAction(proposalId: string) {
  await requireUser();
  const admin = createAdminClient();

  const { data: deletedProposalNumber, error } = await admin.rpc(
    "delete_unissued_draft_proposal",
    { p_proposal_id: proposalId }
  );

  if (error) throw error;
  if (typeof deletedProposalNumber !== "string") {
    throw new Error("The proposal could not be deleted.");
  }

  revalidatePath("/proposals");
  revalidatePath("/clients");
  return deletedProposalNumber;
}
