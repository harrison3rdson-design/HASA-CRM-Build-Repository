"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { requiredText, optionalText, numberValue, boolValue } from "@/lib/validation/common";
import { roundHoursUp } from "@/lib/time-increments";

async function currentAppUserId(supabase: any, authUserId: string) {
  const { data, error } = await supabase
    .from("app_users")
    .select("id,default_bill_rate,internal_cost_rate")
    .eq("auth_user_id", authUserId)
    .single();
  if (error) throw error;
  return data;
}

async function approvedLaborSnapshot(supabase: any, projectId: string, formData: FormData) {
  const encodedSource = optionalText(formData.get("approved_labor_source"));
  const legacySource = optionalText(formData.get("source_fee_item_id"));
  const [sourceKind, sourceId] = encodedSource?.split(":", 2) ?? (legacySource ? ["proposal", legacySource] : []);
  if (!sourceId) return null;

  if (sourceKind === "additional_service") {
    const { data: item, error: itemError } = await supabase
      .from("additional_service_labor_items")
      .select("id,additional_service_id,description,rate")
      .eq("id", sourceId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new Error("The selected Additional Service labor category no longer exists.");

    const { data: authorization, error: authorizationError } = await supabase
      .from("additional_services")
      .select("project_id,status")
      .eq("id", item.additional_service_id)
      .maybeSingle();
    if (authorizationError) throw authorizationError;
    if (!authorization || authorization.project_id !== projectId || authorization.status !== "accepted") {
      throw new Error("The selected labor category is not part of an accepted Additional Service for this project.");
    }

    return {
      id: item.id,
      description: item.description,
      rate: item.rate,
      source_fee_item_id: null,
      source_additional_service_labor_item_id: item.id,
    };
  }

  if (sourceKind !== "proposal") throw new Error("The approved labor source is invalid.");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("source_revision_id")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;
  if (!project.source_revision_id) throw new Error("This project does not have an accepted proposal revision.");

  const { data: feeItem, error: feeError } = await supabase
    .from("proposal_fee_items")
    .select("id,description,rate")
    .eq("id", sourceId)
    .eq("proposal_revision_id", project.source_revision_id)
    .maybeSingle();
  if (feeError) throw feeError;
  if (!feeItem) throw new Error("The selected labor category is not part of this project's accepted proposal.");
  return {
    ...feeItem,
    source_fee_item_id: feeItem.id,
    source_additional_service_labor_item_id: null,
  };
}

export async function startTimerAction(formData: FormData) {
  const { supabase, authUser } = await requireUser();
  const user = await currentAppUserId(supabase, authUser.id);
  const projectId = requiredText(formData.get("project_id"), "Project");
  const feeItem = await approvedLaborSnapshot(supabase, projectId, formData);

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      project_id: projectId,
      source_fee_item_id: feeItem?.source_fee_item_id ?? null,
      source_additional_service_labor_item_id: feeItem?.source_additional_service_labor_item_id ?? null,
      phase_id: optionalText(formData.get("phase_id")),
      user_id: user.id,
      work_date: new Date().toISOString().slice(0, 10),
      activity_type: feeItem?.description ?? requiredText(formData.get("activity_type"), "Activity"),
      description: optionalText(formData.get("description")),
      hours: 0,
      billable: boolValue(formData.get("billable")),
      billing_rate: feeItem ? Number(feeItem.rate) : numberValue(formData.get("billing_rate") ?? user.default_bill_rate ?? 0, "Billing rate", { min: 0 }),
      internal_cost_rate: numberValue(formData.get("internal_cost_rate") ?? user.internal_cost_rate ?? 0, "Internal cost rate", { min: 0 }),
      is_travel_time: boolValue(formData.get("is_travel_time")),
      timer_started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  revalidatePath("/time");
  return data.id as string;
}

export async function stopTimerAction(timeEntryId: string) {
  const { supabase } = await requireUser();

  const { data: entry, error } = await supabase
    .from("time_entries")
    .select("timer_started_at,locked")
    .eq("id", timeEntryId)
    .single();

  if (error) throw error;
  if (entry.locked) throw new Error("This time entry is locked.");
  if (!entry.timer_started_at) throw new Error("Timer has not been started.");

  const stop = new Date();
  const start = new Date(entry.timer_started_at);
  const rawHours = Math.max((stop.getTime() - start.getTime()) / 3600000, 0);
  const roundedHours = roundHoursUp(rawHours);

  const { error: updateError } = await supabase
    .from("time_entries")
    .update({
      timer_stopped_at: stop.toISOString(),
      hours: roundedHours,
    })
    .eq("id", timeEntryId);

  if (updateError) throw updateError;
  revalidatePath("/time");
}

export async function addManualTimeAction(formData: FormData) {
  const { supabase, authUser } = await requireUser();
  const user = await currentAppUserId(supabase, authUser.id);
  const projectId = requiredText(formData.get("project_id"), "Project");
  const feeItem = await approvedLaborSnapshot(supabase, projectId, formData);

  const { error } = await supabase.from("time_entries").insert({
    project_id: projectId,
    source_fee_item_id: feeItem?.source_fee_item_id ?? null,
    source_additional_service_labor_item_id: feeItem?.source_additional_service_labor_item_id ?? null,
    phase_id: optionalText(formData.get("phase_id")),
    user_id: user.id,
    work_date: requiredText(formData.get("work_date"), "Work date"),
    activity_type: feeItem?.description ?? requiredText(formData.get("activity_type"), "Activity"),
    description: optionalText(formData.get("description")),
    hours: roundHoursUp(numberValue(formData.get("hours"), "Hours", { min: 0.01 })),
    billable: boolValue(formData.get("billable")),
    billing_rate: feeItem ? Number(feeItem.rate) : numberValue(formData.get("billing_rate") ?? user.default_bill_rate ?? 0, "Billing rate", { min: 0 }),
    internal_cost_rate: numberValue(formData.get("internal_cost_rate") ?? user.internal_cost_rate ?? 0, "Internal cost rate", { min: 0 }),
    is_travel_time: boolValue(formData.get("is_travel_time")),
  });

  if (error) throw error;
  revalidatePath("/time");
  revalidatePath(`/projects/${projectId}`);
  const returnTo = optionalText(formData.get("return_to"));
  if (returnTo === `/projects/${projectId}`) redirect(returnTo);
}
