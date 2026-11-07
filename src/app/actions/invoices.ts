"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import { requiredText, optionalText, numberValue, boolValue } from "@/lib/validation/common";
import { parsePaymentTerms } from "@/lib/payment-terms";
import { roundHoursUp } from "@/lib/time-increments";
import { Policies } from "@/lib/auth/action-policy";

export async function createInvoiceAction(formData: FormData) {
  await Policies.invoiceCreate();
  const admin = createAdminClient();

  const invoiceMode = requiredText(formData.get("invoice_mode"), "Invoice source");
  if (!["project", "standalone"].includes(invoiceMode)) {
    throw new Error("Choose an approved project or a direct client invoice.");
  }
  const invoiceDate = requiredText(formData.get("invoice_date"), "Invoice date");
  const projectId = invoiceMode === "project"
    ? requiredText(formData.get("project_id"), "Project")
    : null;
  const invoiceType = invoiceMode === "standalone"
    ? "standalone"
    : requiredText(formData.get("invoice_type"), "Invoice type");
  if (invoiceMode === "project" && !["advance", "progress", "final"].includes(invoiceType)) {
    throw new Error("Invoice type must be Advance, Progress, or Final.");
  }

  const includeTime = invoiceType === "final" || boolValue(formData.get("include_time"));
  const includeExpenses = invoiceType === "final" || boolValue(formData.get("include_expenses"));
  const includeUnitWork = invoiceType === "final" || boolValue(formData.get("include_unit_work"));
  const advanceMethod = invoiceType === "advance"
    ? requiredText(formData.get("advance_method"), "Advance calculation")
    : null;
  const advanceValue = invoiceType === "advance"
    ? numberValue(formData.get("advance_value"), "Advance value", { min: 0.01 })
    : null;

  if (invoiceType === "advance" && !["amount", "percentage"].includes(advanceMethod ?? "")) {
    throw new Error("Choose a dollar amount or percentage for the advance.");
  }
  if (invoiceType === "advance" && advanceMethod === "percentage" && Number(advanceValue) > 100) {
    throw new Error("Advance percentage cannot exceed 100.");
  }
  if (invoiceType === "progress" && !includeTime && !includeExpenses && !includeUnitWork) {
    throw new Error("Choose unbilled time, per-unit work, expenses and materials, or a combination.");
  }

  let clientId: string;
  let contactId: string | null = null;
  let inheritedPaymentTerms: string | null = null;

  if (projectId) {
    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("client_id,source_revision_id,primary_contact_id,project_number")
      .eq("id", projectId)
      .single();
    if (projectError) throw projectError;
    if (project.project_number.startsWith("SVC-")) {
      throw new Error("Create recurring invoices from the service agreement.");
    }
    clientId = project.client_id;
    contactId = project.primary_contact_id;

    if (project.source_revision_id) {
      const { data: revision, error: revisionError } = await admin
        .from("proposal_revisions")
        .select("payment_terms")
        .eq("id", project.source_revision_id)
        .single();
      if (revisionError) throw revisionError;
      inheritedPaymentTerms = revision.payment_terms;
    }
  } else {
    clientId = requiredText(formData.get("client_id"), "Client");
    contactId = requiredText(formData.get("contact_id"), "Billing contact");

    const [{ data: client, error: clientError }, { data: contact, error: contactError }] = await Promise.all([
      admin.from("clients").select("id").eq("id", clientId).eq("active", true).single(),
      admin.from("contacts").select("id,client_id").eq("id", contactId).eq("client_id", clientId).single(),
    ]);
    if (clientError || !client) throw new Error("Choose an active customer.");
    if (contactError || !contact) throw new Error("Choose a billing contact for that customer.");
  }

  if (!inheritedPaymentTerms) {
    const { data: settings, error: settingsError } = await admin
      .from("company_settings")
      .select("default_payment_terms")
      .limit(1)
      .single();
    if (settingsError) throw settingsError;
    inheritedPaymentTerms = settings.default_payment_terms;
  }

  const numberResult = projectId
    ? await admin.rpc("next_invoice_number", { p_project_id: projectId })
    : await admin.rpc("next_standalone_invoice_number", { p_invoice_date: invoiceDate });
  const { data: invoiceNumber, error: numberError } = numberResult;
  if (numberError) throw numberError;

  const { data, error } = await admin
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      project_id: projectId,
      client_id: clientId,
      contact_id: contactId,
      invoice_type: invoiceType,
      invoice_date: invoiceDate,
      due_date: null,
      payment_terms: parsePaymentTerms(optionalText(formData.get("payment_terms")) ?? inheritedPaymentTerms),
      customer_notes: optionalText(formData.get("customer_notes")),
      internal_notes: optionalText(formData.get("internal_notes")),
      include_expense_detail: boolValue(formData.get("include_expense_detail")),
      include_receipt_appendix: boolValue(formData.get("include_receipt_appendix")),
      status: "draft",
    })
    .select("id,invoice_number")
    .single();

  if (error) throw error;

  if (projectId) {
    const { error: buildError } = await admin.rpc("build_invoice_workflow_v2", {
      p_invoice_id: data.id,
      p_include_time: includeTime,
      p_include_expenses: includeExpenses,
      p_include_unit_work: includeUnitWork,
      p_advance_method: advanceMethod,
      p_advance_value: advanceValue,
    });
    if (buildError) {
      await admin.from("invoices").delete().eq("id", data.id).eq("status", "draft");
      throw buildError;
    }
  }

  revalidatePath("/billing");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  redirect(`/billing/${data.id}`);
}

export async function addInvoiceItemAction(formData: FormData) {
  await Policies.invoiceCreate();
  const admin = createAdminClient();

  const invoiceId = requiredText(formData.get("invoice_id"), "Invoice");
  const itemType = requiredText(formData.get("item_type"), "Item type");
  if (!["professional_fee", "expense", "adjustment", "credit"].includes(itemType)) {
    throw new Error("Choose a supported direct-invoice line type.");
  }
  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .select("status,locked,invoice_type")
    .eq("id", invoiceId)
    .single();
  if (invoiceError) throw invoiceError;
  if (invoice.invoice_type !== "standalone" || invoice.status !== "draft" || invoice.locked) {
    throw new Error("Line items can only be changed on an unlocked direct-invoice draft.");
  }

  const enteredQuantity = numberValue(formData.get("quantity"), "Quantity", { min: 0.001 });
  const quantity = ["hourly", "travel_time"].includes(itemType)
    ? roundHoursUp(enteredQuantity)
    : enteredQuantity;
  const rate = numberValue(formData.get("rate"), "Rate");
  const calculatedAmount = quantity * Math.abs(rate);
  const amount = itemType === "credit" ? -calculatedAmount : calculatedAmount;

  const { error } = await admin.from("invoice_items").insert({
    invoice_id: invoiceId,
    item_type: itemType,
    description: requiredText(formData.get("description"), "Description"),
    quantity,
    rate,
    amount,
    project_phase_id: optionalText(formData.get("project_phase_id")),
    sort_order: Number(formData.get("sort_order") ?? 0),
  });
  if (error) throw error;

  await admin.rpc("recalculate_invoice", { p_invoice_id: invoiceId });
  revalidatePath("/billing");
  revalidatePath(`/billing/${invoiceId}`);
}

export async function deleteInvoiceItemAction(formData: FormData) {
  await Policies.invoiceCreate();
  const admin = createAdminClient();
  const invoiceId = requiredText(formData.get("invoice_id"), "Invoice");
  const itemId = requiredText(formData.get("item_id"), "Line item");

  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .select("status,locked,invoice_type")
    .eq("id", invoiceId)
    .single();
  if (invoiceError) throw invoiceError;
  if (invoice.invoice_type !== "standalone" || invoice.status !== "draft" || invoice.locked) {
    throw new Error("Line items can only be changed on an unlocked direct-invoice draft.");
  }

  const { error } = await admin
    .from("invoice_items")
    .delete()
    .eq("id", itemId)
    .eq("invoice_id", invoiceId);
  if (error) throw error;

  await admin.rpc("recalculate_invoice", { p_invoice_id: invoiceId });
  revalidatePath("/billing");
  revalidatePath(`/billing/${invoiceId}`);
}

export async function issueInvoiceAction(invoiceId: string) {
  await Policies.invoiceIssue();
  const admin = createAdminClient();
  const { error } = await admin.rpc("issue_invoice", { p_invoice_id: invoiceId });
  if (error) throw error;
  revalidatePath("/billing");
}

export async function recordPaymentAction(formData: FormData) {
  await Policies.paymentPost();
  const admin = createAdminClient();

  const { error } = await admin.rpc("record_invoice_payment", {
    p_invoice_id: requiredText(formData.get("invoice_id"), "Invoice"),
    p_amount: numberValue(formData.get("amount"), "Amount", { min: 0.01 }),
    p_payment_method: requiredText(formData.get("payment_method"), "Payment method"),
    p_payment_date: requiredText(formData.get("payment_date"), "Payment date"),
    p_reference_number: optionalText(formData.get("reference_number")),
    p_notes: optionalText(formData.get("notes")),
  });

  if (error) throw error;
  revalidatePath("/billing");
}

export async function deleteUnissuedDraftInvoiceAction(invoiceId: string) {
  const startedAt = Date.now();
  console.log(JSON.stringify({
    level: "info",
    message: "Draft invoice deletion started",
    action: "deleteUnissuedDraftInvoiceAction",
  }));
  await Policies.invoiceWrite();
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("delete_unissued_draft_invoice", {
    p_invoice_id: invoiceId,
  });

  if (error) {
    console.error(JSON.stringify({
      level: "error",
      message: "Draft invoice deletion failed",
      action: "deleteUnissuedDraftInvoiceAction",
      error: error.message,
      duration_ms: Date.now() - startedAt,
    }));
    throw error;
  }

  const deleted = data as {
    invoice_number?: unknown;
    project_id?: unknown;
  } | null;
  if (
    typeof deleted?.invoice_number !== "string"
    || (deleted?.project_id !== null && typeof deleted?.project_id !== "string")
  ) {
    throw new Error("The invoice could not be deleted.");
  }

  revalidatePath("/billing");
  if (typeof deleted.project_id === "string") revalidatePath(`/projects/${deleted.project_id}`);
  console.log(JSON.stringify({
    level: "info",
    message: "Draft invoice deletion completed",
    action: "deleteUnissuedDraftInvoiceAction",
    duration_ms: Date.now() - startedAt,
  }));
  return {
    invoiceNumber: deleted.invoice_number,
    projectId: typeof deleted.project_id === "string" ? deleted.project_id : null,
  };
}
