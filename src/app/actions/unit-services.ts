"use server";

import { revalidatePath } from "next/cache";
import { Policies } from "@/lib/auth/action-policy";
import { requiredText, optionalText, numberValue, boolValue } from "@/lib/validation/common";

export async function addUnitServiceEntryAction(formData: FormData) {
  const { supabase, appUser } = await Policies.unitServiceOwn();
  const projectId = requiredText(formData.get("project_id"), "Project");
  const sourceFeeItemId = requiredText(formData.get("source_fee_item_id"), "Approved service");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("source_revision_id")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;
  if (!project.source_revision_id) {
    throw new Error("This project does not have an accepted proposal revision.");
  }

  const { data: service, error: serviceError } = await supabase
    .from("proposal_fee_items")
    .select("id,unit,rate")
    .eq("id", sourceFeeItemId)
    .eq("proposal_revision_id", project.source_revision_id)
    .eq("billing_type", "unit")
    .maybeSingle();
  if (serviceError) throw serviceError;
  if (!service) {
    throw new Error("The selected per-unit service is not part of this project's accepted proposal.");
  }

  const { error } = await supabase.from("unit_service_entries").insert({
    project_id: projectId,
    source_fee_item_id: service.id,
    work_date: requiredText(formData.get("work_date"), "Date"),
    quantity: numberValue(formData.get("quantity"), "Quantity", { min: 0.001 }),
    unit: service.unit,
    billing_rate: service.rate,
    description: optionalText(formData.get("description")),
    billable: boolValue(formData.get("billable")),
    created_by: appUser.id,
  });
  if (error) throw error;

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/billing/new");
}

export async function deleteUnitServiceEntryAction(entryId: string) {
  const { supabase } = await Policies.unitServiceOwn();
  const { data: entry, error: readError } = await supabase
    .from("unit_service_entries")
    .select("id,project_id,locked,invoice_item_id")
    .eq("id", entryId)
    .maybeSingle();
  if (readError) throw readError;
  if (!entry) throw new Error("The per-unit work entry was not found.");
  if (entry.locked || entry.invoice_item_id) {
    throw new Error("Invoiced or locked per-unit work cannot be deleted.");
  }

  const { data: deleted, error } = await supabase
    .from("unit_service_entries")
    .delete()
    .eq("id", entryId)
    .eq("locked", false)
    .is("invoice_item_id", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!deleted) throw new Error("The per-unit work entry changed and could not be deleted.");

  revalidatePath(`/projects/${entry.project_id}`);
}
