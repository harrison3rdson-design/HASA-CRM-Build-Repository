"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requiredText, optionalText, numberValue, boolValue } from "@/lib/validation/common";
import { calculateExpenseBillableAmount } from "@/lib/billing";
import { receiptStoragePath } from "@/lib/storage/private-storage";

export async function createExpenseAction(formData: FormData) {
  const { supabase, authUser } = await requireUser();

  const { data: user } = await supabase
    .from("app_users")
    .select("id")
    .eq("auth_user_id", authUser.id)
    .single();

  const actualCost = numberValue(formData.get("actual_cost"), "Actual cost", { min: 0 });
  const rule = requiredText(formData.get("billing_rule"), "Billing rule") as any;
  const billable = boolValue(formData.get("billable"));
  const markupPercent = Number(formData.get("markup_percent") ?? 0);
  const fixedBillableAmount = Number(formData.get("fixed_billable_amount") ?? 0);

  const billableAmount = billable
    ? calculateExpenseBillableAmount({ actualCost, rule, markupPercent, fixedBillableAmount })
    : 0;

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      project_id: requiredText(formData.get("project_id"), "Project"),
      source_estimate_id: optionalText(formData.get("source_estimate_id")),
      expense_date: requiredText(formData.get("expense_date"), "Expense date"),
      category: requiredText(formData.get("category"), "Category"),
      description: optionalText(formData.get("description")),
      vendor: optionalText(formData.get("vendor")),
      actual_cost: actualCost,
      billable,
      billable_amount: billableAmount,
      billing_rule: rule,
      markup_percent: markupPercent,
      created_by: user?.id ?? null,
    })
    .select("id,project_id")
    .single();

  if (error) throw error;
  revalidatePath("/expenses");
  return data;
}

export async function uploadReceiptForExpenseAction(formData: FormData) {
  await requireUser();
  const admin = createAdminClient();

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Receipt file is required.");

  if (file.size > 15 * 1024 * 1024) throw new Error("Receipt file exceeds 15 MB.");

  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) throw new Error("Unsupported receipt file type.");

  const expenseId = requiredText(formData.get("expense_id"), "Expense");
  const projectId = requiredText(formData.get("project_id"), "Project");
  const clientId = requiredText(formData.get("client_id"), "Client");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
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

  if (attachmentError) throw attachmentError;

  revalidatePath("/expenses");
  revalidatePath("/receipts");
}
