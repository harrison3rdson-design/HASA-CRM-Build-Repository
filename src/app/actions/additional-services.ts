"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requiredText, optionalText, numberValue } from "@/lib/validation/common";

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
  void data;
  revalidatePath(`/projects/${projectId}`);
}
