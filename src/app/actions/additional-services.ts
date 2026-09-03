"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Policies } from "@/lib/auth/action-policy";
import { createAdminClient } from "@/lib/supabase-admin";
import { requiredText } from "@/lib/validation/common";
import { parseAdditionalServiceItems } from "@/lib/additional-service-items";

export async function createAdditionalServiceAction(formData: FormData) {
  await Policies.projectWrite();
  const admin = createAdminClient();

  const projectId = requiredText(formData.get("project_id"), "Project");
  const { laborItems, expenseItems } = parseAdditionalServiceItems(formData);
  const { data: createdId, error } = await admin.rpc("create_additional_service_draft", {
    p_project_id: projectId,
    p_description: requiredText(formData.get("description"), "Description"),
    p_billing_type: requiredText(formData.get("billing_type"), "Authorization type"),
    p_labor_items: laborItems,
    p_expense_items: expenseItems,
  });

  if (error) throw error;
  const data = { id: createdId };
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/additional-services/${data.id}`);
}

export async function updateAdditionalServiceAction(formData: FormData) {
  await Policies.projectWrite();
  const admin = createAdminClient();

  const additionalServiceId = requiredText(formData.get("additional_service_id"), "Additional service");
  const { laborItems, expenseItems } = parseAdditionalServiceItems(formData);
  const { data: existing, error: existingError } = await admin
    .from("additional_services")
    .select("project_id,status,locked")
    .eq("id", additionalServiceId)
    .single();

  if (existingError) throw existingError;
  if (existing.locked || existing.status !== "draft") {
    throw new Error("Only an unlocked draft authorization can be edited.");
  }

  const { data: updated, error } = await admin.rpc("update_additional_service_draft", {
    p_additional_service_id: additionalServiceId,
    p_description: requiredText(formData.get("description"), "Description"),
    p_billing_type: requiredText(formData.get("billing_type"), "Authorization type"),
    p_labor_items: laborItems,
    p_expense_items: expenseItems,
  });

  if (error) throw error;
  if (!updated) throw new Error("This authorization is no longer editable.");

  revalidatePath(`/projects/${existing.project_id}`);
  revalidatePath(`/additional-services/${additionalServiceId}`);
  revalidatePath(`/additional-service-previews/${additionalServiceId}`);
  redirect(`/additional-services/${additionalServiceId}`);
}
