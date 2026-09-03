"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Policies } from "@/lib/auth/action-policy";
import { createAdminClient } from "@/lib/supabase-admin";
import { requiredText, optionalText, numberValue, boolValue } from "@/lib/validation/common";
import { calculateExpenseBillableAmount } from "@/lib/billing";
import { receiptStoragePath } from "@/lib/storage/private-storage";
import { requiredUuid, safeOriginalFilename, validateUploadedFile } from "@/lib/security/uploads";

type ExpenseRule = "actual" | "actual_plus_markup" | "fixed_rate" | "per_diem" | "mileage" | "allowance" | "included" | "not_billable";

async function approvedExpenseSnapshot(supabase: any, projectId: string, formData: FormData) {
  const encodedSource = optionalText(formData.get("approved_expense_source"));
  const legacySource = optionalText(formData.get("source_estimate_id"));
  const [sourceKind, sourceId] = encodedSource?.split(":", 2) ?? (legacySource ? ["proposal", legacySource] : []);
  if (!sourceId) return null;

  if (sourceKind === "material") {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("source_revision_id")
      .eq("id", projectId)
      .single();
    if (projectError) throw projectError;
    if (!project.source_revision_id) throw new Error("This project does not have an accepted proposal revision.");

    const { data: material, error: materialError } = await supabase
      .from("proposal_material_items")
      .select("id,description,unit_cost,amount,markup_percent")
      .eq("id", sourceId)
      .eq("proposal_revision_id", project.source_revision_id)
      .maybeSingle();
    if (materialError) throw materialError;
    if (!material) throw new Error("The selected material is not part of this project's accepted proposal.");

    return {
      category: "Materials",
      description: material.description,
      billing_rule: Number(material.markup_percent) > 0 ? "actual_plus_markup" : "actual",
      markup_percent: material.markup_percent,
      estimated_rate: material.unit_cost,
      estimated_amount: material.amount,
      source_estimate_id: null,
      source_material_id: material.id,
      source_additional_service_expense_item_id: null,
    };
  }

  if (sourceKind === "additional_service") {
    const { data: item, error: itemError } = await supabase
      .from("additional_service_expense_items")
      .select("id,additional_service_id,category,billing_rule,markup_percent,estimated_rate,estimated_amount")
      .eq("id", sourceId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new Error("The selected Additional Service expense category no longer exists.");

    const { data: authorization, error: authorizationError } = await supabase
      .from("additional_services")
      .select("project_id,status")
      .eq("id", item.additional_service_id)
      .maybeSingle();
    if (authorizationError) throw authorizationError;
    if (!authorization || authorization.project_id !== projectId || authorization.status !== "accepted") {
      throw new Error("The selected expense category is not part of an accepted Additional Service for this project.");
    }

    return {
      ...item,
      source_estimate_id: null,
      source_material_id: null,
      source_additional_service_expense_item_id: item.id,
    };
  }

  if (sourceKind !== "proposal") throw new Error("The approved expense source is invalid.");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("source_revision_id")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;
  if (!project.source_revision_id) throw new Error("This project does not have an accepted proposal revision.");

  const { data: estimate, error: estimateError } = await supabase
    .from("proposal_expense_estimates")
    .select("id,category,billing_rule,markup_percent,estimated_rate,estimated_amount")
    .eq("id", sourceId)
    .eq("proposal_revision_id", project.source_revision_id)
    .maybeSingle();
  if (estimateError) throw estimateError;
  if (!estimate) throw new Error("The selected expense category is not part of this project's accepted proposal.");
  return {
    ...estimate,
    source_estimate_id: estimate.id,
    source_material_id: null,
    source_additional_service_expense_item_id: null,
  };
}

export async function createExpenseAction(formData: FormData) {
  const { supabase, appUser } = await Policies.expenseWrite();
  const projectId = requiredText(formData.get("project_id"), "Project");

  const actualCost = numberValue(formData.get("actual_cost"), "Actual cost", { min: 0 });
  const estimate = await approvedExpenseSnapshot(supabase, projectId, formData);
  const rule = (estimate?.billing_rule ?? requiredText(formData.get("billing_rule"), "Billing rule")) as ExpenseRule;
  const billable = !["included", "not_billable"].includes(rule) && boolValue(formData.get("billable"));
  const markupPercent = estimate ? Number(estimate.markup_percent) : Number(formData.get("markup_percent") ?? 0);
  const fixedBillableAmount = estimate
    ? Number(estimate.estimated_rate ?? estimate.estimated_amount ?? 0)
    : Number(formData.get("fixed_billable_amount") ?? 0);

  const billableAmount = billable
    ? calculateExpenseBillableAmount({ actualCost, rule, markupPercent, fixedBillableAmount })
    : 0;

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      project_id: projectId,
      source_estimate_id: estimate?.source_estimate_id ?? null,
      source_material_id: estimate?.source_material_id ?? null,
      source_additional_service_expense_item_id: estimate?.source_additional_service_expense_item_id ?? null,
      expense_date: requiredText(formData.get("expense_date"), "Expense date"),
      category: estimate?.category ?? requiredText(formData.get("category"), "Category"),
      description: optionalText(formData.get("description")) ?? estimate?.description ?? null,
      vendor: optionalText(formData.get("vendor")),
      actual_cost: actualCost,
      billable,
      billable_amount: billableAmount,
      billing_rule: rule,
      markup_percent: markupPercent,
      created_by: appUser.id,
    })
    .select("id,project_id")
    .single();

  if (error) throw error;
  revalidatePath("/expenses");
  revalidatePath(`/projects/${projectId}`);
  const returnTo = optionalText(formData.get("return_to"));
  if (returnTo === `/projects/${projectId}`) redirect(returnTo);
  void data;
}

export async function uploadReceiptForExpenseAction(formData: FormData) {
  await Policies.expenseWrite();
  const admin = createAdminClient();

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Receipt file is required.");
  await validateUploadedFile(file, "Receipt file", 10 * 1024 * 1024);

  const expenseId = requiredUuid(formData.get("expense_id"), "Expense");
  const projectId = requiredUuid(formData.get("project_id"), "Project");
  const clientId = requiredUuid(formData.get("client_id"), "Client");

  const [{ data: project, error: projectError }, { data: expense, error: expenseError }] = await Promise.all([
    admin.from("projects").select("id").eq("id", projectId).eq("client_id", clientId).maybeSingle(),
    admin.from("expenses").select("id").eq("id", expenseId).eq("project_id", projectId).maybeSingle(),
  ]);
  if (projectError) throw projectError;
  if (expenseError) throw expenseError;
  if (!project || !expense) {
    throw new Error("The selected receipt, expense, project, and client do not match.");
  }

  const safeName = safeOriginalFilename(file.name);
  const path = receiptStoragePath({ clientId, projectId, expenseId, filename: `${crypto.randomUUID()}-${safeName}` });

  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: storageError } = await admin.storage
    .from(process.env.RECEIPTS_BUCKET ?? "hasa-receipts")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (storageError) throw storageError;

  const { error: attachmentError } = await admin.from("expense_attachments").insert({
    expense_id: expenseId,
    storage_path: path,
    original_filename: file.name,
    mime_type: file.type,
    file_size: file.size,
    attachment_type: "receipt",
  });

  if (attachmentError) {
    await admin.storage.from(process.env.RECEIPTS_BUCKET ?? "hasa-receipts").remove([path]);
    throw attachmentError;
  }

  revalidatePath("/expenses");
  revalidatePath("/receipts");
}
