"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import { requiredText, optionalText, numberValue, boolValue } from "@/lib/validation/common";
import { parsePaymentTerms } from "@/lib/payment-terms";
import { parseProposalTerms, resolveDefaultProposalTerms } from "@/lib/proposal-terms";
import {
  calculateExpenseAmount,
  calculateMaterialAmount,
  calculateMaterialUnitPrice,
  calculateServiceAmount,
  parseExpenseBillingRule,
  parseServiceBillingType,
  roundMoney,
  type ServiceBillingType,
} from "@/lib/proposal-items";
import { parseProposalSectionType } from "@/lib/proposal-sections";
import { selectDefaultProposalContact } from "@/lib/proposal-contacts";
import { roundHoursUp } from "@/lib/time-increments";
import { Policies } from "@/lib/auth/action-policy";

const MANUAL_AUTHORIZATION_FILE_LIMIT = 10 * 1024 * 1024;
const MANUAL_AUTHORIZATION_FILE_EXTENSIONS = new Set(["pdf", "eml", "msg", "png", "jpg", "jpeg"]);

export type CreateProposalActionState = {
  status: "idle" | "error";
  message: string;
};

export type ManualProposalAuthorizationResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

function manualAuthorizationMethod(value: FormDataEntryValue | null): "verbal" | "email" {
  const method = requiredText(value, "Authorization method");
  if (method !== "verbal" && method !== "email") {
    throw new Error("Authorization method must be Verbal or Email.");
  }
  return method;
}

function evidenceFile(formData: FormData): File | null {
  const value = formData.get("evidence_file");
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > MANUAL_AUTHORIZATION_FILE_LIMIT) {
    throw new Error("Authorization evidence cannot exceed 10 MB.");
  }

  const extension = value.name.split(".").pop()?.toLowerCase() ?? "";
  if (!MANUAL_AUTHORIZATION_FILE_EXTENSIONS.has(extension)) {
    throw new Error("Authorization evidence must be a PDF, email file, or PNG/JPG image.");
  }
  return value;
}

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
    billing_type: ServiceBillingType;
    quantity: number;
    unit: string;
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
  const materialItems = [] as Array<{
    description: string;
    quantity: number;
    unit: string;
    unit_cost: number;
    markup_percent: number;
    unit_price: number;
    amount: number;
    sort_order: number;
  }>;

  const laborCount = itemCount(formData.get("labor_count"), "Labor line count");
  for (let index = 0; index < laborCount; index += 1) {
    const description = optionalText(formData.get(`labor_description_${index}`));
    const quantityText = optionalText(formData.get(`labor_hours_${index}`));
    const rateText = optionalText(formData.get(`labor_rate_${index}`));
    if (!description && !quantityText && !rateText) continue;

    const billingType = parseServiceBillingType(formData.get(`labor_billing_type_${index}`));
    const enteredQuantity = numberValue(
      quantityText ?? (billingType === "fixed" || billingType === "included" ? "1" : null),
      `Service line ${index + 1} quantity`,
      { min: 0.001 },
    );
    const quantity = billingType === "hourly"
      ? roundHoursUp(enteredQuantity)
      : billingType === "fixed" || billingType === "included"
        ? 1
        : enteredQuantity;
    const rate = billingType === "included"
      ? 0
      : numberValue(rateText, `Service line ${index + 1} rate`, { min: 0 });
    const unit = billingType === "hourly"
      ? "hour"
      : billingType === "fixed"
        ? "project"
        : billingType === "included"
          ? "included"
          : requiredText(formData.get(`labor_unit_${index}`), `Service line ${index + 1} unit`);
    feeItems.push({
      description: requiredText(description, `Service line ${index + 1} description`),
      billing_type: billingType,
      quantity,
      unit,
      rate,
      amount: calculateServiceAmount(billingType, quantity, rate),
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

  const materialCount = itemCount(formData.get("material_count"), "Material line count");
  for (let index = 0; index < materialCount; index += 1) {
    const description = optionalText(formData.get(`material_description_${index}`));
    const quantityText = optionalText(formData.get(`material_quantity_${index}`));
    const unit = optionalText(formData.get(`material_unit_${index}`));
    const unitCostText = optionalText(formData.get(`material_unit_cost_${index}`));
    const markupText = optionalText(formData.get(`material_markup_${index}`));
    const quantityChanged = quantityText !== null && quantityText !== "1";
    const hasMarkup = markupText !== null && Number(markupText) !== 0;
    if (!description && !unitCostText && !quantityChanged && !hasMarkup) continue;

    const quantity = numberValue(quantityText ?? "1", `Material line ${index + 1} quantity`, { min: 0 });
    const unitCost = numberValue(unitCostText ?? "0", `Material line ${index + 1} unit cost`, { min: 0 });
    const markupPercent = numberValue(markupText ?? "0", `Material line ${index + 1} markup`, { min: 0, max: 999.999 });
    materialItems.push({
      description: requiredText(description, `Material line ${index + 1} description`),
      quantity,
      unit: requiredText(unit, `Material line ${index + 1} unit`),
      unit_cost: unitCost,
      markup_percent: markupPercent,
      unit_price: calculateMaterialUnitPrice(unitCost, markupPercent),
      amount: calculateMaterialAmount(quantity, unitCost, markupPercent),
      sort_order: index,
    });
  }

  return {
    feeItems,
    expenseItems,
    materialItems,
    professionalFee: roundMoney(feeItems.reduce((sum, item) => sum + item.amount, 0)),
    estimatedExpenses: roundMoney(expenseItems.reduce((sum, item) => sum + item.estimated_amount, 0)),
    estimatedMaterials: roundMoney(materialItems.reduce((sum, item) => sum + item.amount, 0)),
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
  const { supabase, appUser } = await Policies.proposalWrite();

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
    items: { feeItems, expenseItems, materialItems, professionalFee, estimatedExpenses, estimatedMaterials },
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

  const { data: settings, error: settingsError } = await supabase
    .from("company_settings")
    .select("default_payment_terms,default_proposal_terms")
    .limit(1)
    .single();
  if (settingsError) throw settingsError;
  if (!paymentTerms) paymentTerms = settings.default_payment_terms;
  const proposalTerms = resolveDefaultProposalTerms(settings.default_proposal_terms);

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

  const { data: revision, error: revisionError } = await supabase
    .from("proposal_revisions")
    .insert({
      proposal_id: proposal.id,
      revision_number: 1,
      professional_fee: professionalFee,
      estimated_expenses: estimatedExpenses,
      estimated_materials: estimatedMaterials,
      payment_terms: parsedPaymentTerms,
      proposal_terms: proposalTerms,
      validity_days: validityDays,
      billing_method: billingMethod,
      created_by: appUser.id,
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

  if (materialItems.length) {
    const { error: materialError } = await supabase
      .from("proposal_material_items")
      .insert(materialItems.map((item) => ({ ...item, proposal_revision_id: revision.id })));
    if (materialError) {
      await discardIncompleteProposal();
      throw materialError;
    }
  }

  revalidatePath("/proposals");
  redirect(`/proposals/${proposal.id}`);
}

export async function updateProposalPrimaryContactAction(formData: FormData) {
  await Policies.proposalWrite();
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
  await Policies.proposalWrite();
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
  await Policies.proposalWrite();
  const admin = createAdminClient();
  const revisionId = requiredText(formData.get("revision_id"), "Proposal revision");
  const paymentTerms = parsePaymentTerms(formData.get("payment_terms"));
  const validityDays = numberValue(formData.get("validity_days"), "Validity days", { min: 1 });
  const billingMethod = optionalText(formData.get("billing_method")) ?? "fixed_fee";
  const proposalTerms = parseProposalTerms(formData.get("proposal_terms"));
  const scopeSections = parseProposalSections(formData);
  const { feeItems, expenseItems, materialItems } = parseProposalItems(formData);

  const { data: proposalId, error } = await admin.rpc("update_proposal_revision_draft_v5", {
    p_revision_id: revisionId,
    p_payment_terms: paymentTerms,
    p_validity_days: validityDays,
    p_billing_method: billingMethod,
    p_proposal_terms: proposalTerms,
    p_sections: scopeSections,
    p_fee_items: feeItems,
    p_expense_items: expenseItems,
    p_material_items: materialItems,
  });

  if (error) throw error;
  if (!proposalId) throw new Error("The proposal revision could not be saved.");

  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
  redirect(`/proposals/${proposalId}`);
}

export async function createProposalRevisionAction(proposalId: string) {
  await Policies.proposalWrite();
  const admin = createAdminClient();

  const [
    { data: current, error },
    { data: settings, error: settingsError },
  ] = await Promise.all([
    admin
      .from("proposal_revisions")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("revision_number", { ascending: false })
      .limit(1)
      .single(),
    admin.from("company_settings").select("default_proposal_terms").limit(1).single(),
  ]);

  if (error) throw error;
  if (settingsError) throw settingsError;

  const nextRevision = Number(current.revision_number) + 1;

  const { data: revision, error: insertError } = await admin
    .from("proposal_revisions")
    .insert({
      proposal_id: proposalId,
      revision_number: nextRevision,
      professional_fee: current.professional_fee,
      estimated_expenses: current.estimated_expenses,
      estimated_materials: current.estimated_materials,
      billing_method: current.billing_method,
      payment_terms: current.payment_terms,
      proposal_terms: resolveDefaultProposalTerms(
        current.proposal_terms ?? settings.default_proposal_terms,
      ),
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
  await copyChildren("proposal_material_items", "proposal_revision_id");

  await admin
    .from("proposals")
    .update({ current_revision: nextRevision, status: "draft" })
    .eq("id", proposalId);

  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
  return revision.id as string;
}

export async function deleteLatestProposalRevisionAction(proposalId: string) {
  await Policies.proposalWrite();
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
  await Policies.proposalWrite();
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

export async function recordManualProposalAuthorizationAction(
  formData: FormData,
): Promise<ManualProposalAuthorizationResult> {
  try {
    const { appUser } = await Policies.proposalWrite();
    const admin = createAdminClient();
    const proposalId = requiredText(formData.get("proposal_id"), "Proposal");
    const revisionId = requiredText(formData.get("revision_id"), "Proposal version");
    const method = manualAuthorizationMethod(formData.get("authorization_method"));
    const signerName = requiredText(formData.get("signer_name"), "Customer name");
    const signerTitle = optionalText(formData.get("signer_title"));
    const signerEmail = optionalText(formData.get("signer_email"));
    const signerMobile = optionalText(formData.get("signer_mobile"));
    const authorizedAtText = requiredText(formData.get("authorized_at"), "Authorization date and time");
    const notes = requiredText(formData.get("recording_notes"), "Authorization notes");
    const attested = boolValue(formData.get("authorization_attestation"));
    const file = evidenceFile(formData);

    if (!attested) throw new Error("Confirm that the authorization information is accurate.");
    if (method === "email" && !file) throw new Error("Attach the customer email or other written authorization evidence.");
    if (notes.length > 4000) throw new Error("Authorization notes cannot exceed 4,000 characters.");

    const authorizedAt = new Date(authorizedAtText);
    if (Number.isNaN(authorizedAt.getTime())) throw new Error("Authorization date and time are invalid.");
    if (authorizedAt.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new Error("Authorization date and time cannot be in the future.");
    }

    const { data: revision, error: revisionError } = await admin
      .from("proposal_revisions")
      .select(`
        id,proposal_id,revision_number,locked,created_at,
        proposal:proposals(id,proposal_number,client_id,current_revision,status)
      `)
      .eq("id", revisionId)
      .single();
    if (revisionError) throw revisionError;

    const proposal = Array.isArray(revision.proposal) ? revision.proposal[0] : revision.proposal;
    if (!proposal || proposal.id !== proposalId) throw new Error("The proposal version does not match this proposal.");
    if (proposal.current_revision !== revision.revision_number) {
      throw new Error("Only the current proposal version can be authorized.");
    }
    if (!revision.locked || !["sent", "viewed", "changes_requested"].includes(proposal.status)) {
      throw new Error("Only a sent proposal awaiting customer authorization can be recorded manually.");
    }
    if (authorizedAt < new Date(revision.created_at)) {
      throw new Error("Authorization date and time cannot be earlier than the proposal version.");
    }

    let evidenceDocumentId: string | null = null;
    let evidenceStoragePath: string | null = null;

    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      evidenceStoragePath = `clients/${proposal.client_id}/proposals/${proposal.proposal_number}/authorizations/${crypto.randomUUID()}-${safeName}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const bucket = process.env.DOCUMENTS_BUCKET ?? "hasa-documents";
      const { error: storageError } = await admin.storage.from(bucket).upload(
        evidenceStoragePath,
        bytes,
        { contentType: file.type || "application/octet-stream", upsert: false },
      );
      if (storageError) throw storageError;

      const { data: document, error: documentError } = await admin.from("documents").insert({
        client_id: proposal.client_id,
        document_type: "proposal_authorization_evidence",
        document_subtype: method,
        title: `Proposal ${proposal.proposal_number} ${method} authorization evidence`,
        storage_path: evidenceStoragePath,
        original_filename: file.name,
        mime_type: file.type || null,
        file_size: file.size,
        related_record_type: "proposal",
        related_record_id: proposal.id,
        document_date: authorizedAt.toISOString().slice(0, 10),
        locked: true,
        uploaded_by: appUser.id,
      }).select("id").single();

      if (documentError) {
        await admin.storage.from(bucket).remove([evidenceStoragePath]);
        throw documentError;
      }
      evidenceDocumentId = document.id;
    }

    const { data: projectId, error: acceptanceError } = await admin.rpc(
      "record_manual_proposal_acceptance",
      {
        p_revision_id: revisionId,
        p_signer_name: signerName,
        p_signer_title: signerTitle,
        p_signer_email: signerEmail,
        p_signer_mobile: signerMobile,
        p_authorization_method: method,
        p_authorized_at: authorizedAt.toISOString(),
        p_recording_notes: notes,
        p_evidence_document_id: evidenceDocumentId,
        p_recorded_by: appUser.id,
      },
    );

    if (acceptanceError || !projectId) {
      if (evidenceDocumentId) await admin.from("documents").delete().eq("id", evidenceDocumentId);
      if (evidenceStoragePath) {
        await admin.storage.from(process.env.DOCUMENTS_BUCKET ?? "hasa-documents").remove([evidenceStoragePath]);
      }
      throw acceptanceError ?? new Error("The manual authorization could not be recorded.");
    }

    revalidatePath("/proposals");
    revalidatePath(`/proposals/${proposalId}`);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/documents");
    return { ok: true, projectId: String(projectId) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The manual authorization could not be recorded.",
    };
  }
}
