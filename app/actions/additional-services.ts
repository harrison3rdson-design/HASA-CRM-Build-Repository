"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requiredText, numberValue } from "@/lib/validation/common";

export async function createAdditionalServiceAction(formData: FormData) {
  await requireUser();
  const admin = createAdminClient();

  const projectId = requiredText(formData.get("project_id"), "Project");
  const { data: authNumber, error: numberError } = await admin.rpc(
    "next_additional_service_number",
    { p_project_id: projectId }
  );
  if (numberError) throw numberError;

  const { data, error } = await admin
    .from("additional_services")
    .insert({
      authorization_number: authNumber,
      project_id: projectId,
      description: requiredText(formData.get("description"), "Description"),
      billing_type: requiredText(formData.get("billing_type"), "Billing type"),
      authorized_amount: numberValue(formData.get("authorized_amount"), "Authorized amount", { min: 0 }),
      status: "draft",
    })
    .select("id")
    .single();

  if (error) throw error;
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/additional-services/${data.id}`);
}

export async function updateAdditionalServiceAction(formData: FormData) {
  await requireUser();
  const admin = createAdminClient();

  const additionalServiceId = requiredText(formData.get("additional_service_id"), "Additional service");
  const { data: existing, error: existingError } = await admin
    .from("additional_services")
    .select("project_id,status,locked")
    .eq("id", additionalServiceId)
    .single();

  if (existingError) throw existingError;
  if (existing.locked || existing.status !== "draft") {
    throw new Error("Only an unlocked draft authorization can be edited.");
  }

  const { data: updated, error } = await admin
    .from("additional_services")
    .update({
      description: requiredText(formData.get("description"), "Description"),
      billing_type: requiredText(formData.get("billing_type"), "Billing type"),
      authorized_amount: numberValue(formData.get("authorized_amount"), "Authorized amount", { min: 0 }),
    })
    .eq("id", additionalServiceId)
    .eq("status", "draft")
    .eq("locked", false)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!updated) throw new Error("This authorization is no longer editable.");

  revalidatePath(`/projects/${existing.project_id}`);
  revalidatePath(`/additional-services/${additionalServiceId}`);
  revalidatePath(`/additional-service-previews/${additionalServiceId}`);
  redirect(`/additional-services/${additionalServiceId}`);
}
