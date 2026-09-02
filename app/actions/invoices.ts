"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requiredText, optionalText, numberValue, boolValue } from "@/lib/validation/common";

export async function createInvoiceAction(formData: FormData) {
  await requireUser();
  const admin = createAdminClient();

  const projectId = requiredText(formData.get("project_id"), "Project");

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .single();

  if (projectError) throw projectError;

  const { data: invoiceNumber, error: numberError } = await admin.rpc("next_invoice_number", {
    p_project_id: projectId,
  });
  if (numberError) throw numberError;

  const { data, error } = await admin
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      project_id: projectId,
      client_id: project.client_id,
      invoice_type: requiredText(formData.get("invoice_type"), "Invoice type"),
      invoice_date: requiredText(formData.get("invoice_date"), "Invoice date"),
      due_date: optionalText(formData.get("due_date")),
      payment_terms: optionalText(formData.get("payment_terms")) ?? "NET 15",
      customer_notes: optionalText(formData.get("customer_notes")),
      internal_notes: optionalText(formData.get("internal_notes")),
      include_expense_detail: boolValue(formData.get("include_expense_detail")),
      include_receipt_appendix: boolValue(formData.get("include_receipt_appendix")),
      status: "draft",
    })
    .select("id,invoice_number")
    .single();

  if (error) throw error;
  revalidatePath("/billing");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/billing/${data.id}`);
}

export async function addInvoiceItemAction(formData: FormData) {
  await requireUser();
  const admin = createAdminClient();

  const invoiceId = requiredText(formData.get("invoice_id"), "Invoice");
  const quantity = numberValue(formData.get("quantity"), "Quantity", { min: 0 });
  const rate = numberValue(formData.get("rate"), "Rate");
  const amount = Number(formData.get("amount") ?? quantity * rate);

  const { error } = await admin.from("invoice_items").insert({
    invoice_id: invoiceId,
    item_type: requiredText(formData.get("item_type"), "Item type"),
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
}

export async function issueInvoiceAction(invoiceId: string) {
  await requireUser();
  const admin = createAdminClient();
  const { error } = await admin.rpc("issue_invoice", { p_invoice_id: invoiceId });
  if (error) throw error;
  revalidatePath("/billing");
}

export async function recordPaymentAction(formData: FormData) {
  await requireUser();
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
