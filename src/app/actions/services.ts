"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import { Policies } from "@/lib/auth/action-policy";
import {
  requiredText,
  optionalText,
  numberValue,
} from "@/lib/validation/common";
import { safeModelUrl, todayInNewYork } from "@/lib/services/terms";

export type ServiceActionResult = { error?: string; href?: string };
const id = (f: FormData, key: string) => {
  const s = requiredText(f.get(key), key);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  )
    throw new Error(`Invalid ${key}.`);
  return s;
};
const date = (f: FormData, key: string) => {
  const s = requiredText(f.get(key), key);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    throw new Error(`Invalid ${key}.`);
  return s;
};
const pick = (f: FormData, key: string, values: string[]) => {
  const s = requiredText(f.get(key), key);
  if (!values.includes(s)) throw new Error(`Invalid ${key}.`);
  return s;
};
async function run(
  fn: () => Promise<string | void>,
): Promise<ServiceActionResult> {
  try {
    const href = await fn();
    revalidatePath("/services");
    revalidatePath("/properties");
    revalidatePath("/dashboard");
    revalidatePath("/billing");
    return href ? { href } : {};
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : e && typeof e === "object" && "message" in e
            ? String(e.message)
            : "The change could not be saved.",
    };
  }
}

export async function savePropertyAction(f: FormData) {
  return run(async () => {
    await Policies.clientWrite();
    const db = createAdminClient();
    const existing = optionalText(f.get("property_id"));
    const clientId = id(f, "client_id");
    const payload = {
      client_id: clientId,
      name: requiredText(f.get("name"), "Property name"),
      property_type: pick(f, "property_type", [
        "vacation_rental",
        "commercial",
        "resort",
        "other",
      ]),
      address: requiredText(f.get("address"), "Address"),
      square_feet: optionalText(f.get("square_feet"))
        ? numberValue(f.get("square_feet"), "Area", { min: 0 })
        : null,
      access_notes: optionalText(f.get("access_notes")),
      active: f.get("active") === "on",
    };
    if (existing) {
      const { data: old, error } = await db
        .from("properties")
        .select("client_id")
        .eq("id", id(f, "property_id"))
        .single();
      if (error) throw error;
      if (old.client_id !== clientId)
        throw new Error("Property client cannot be changed.");
    }
    const { data, error } = await (
      existing
        ? db.from("properties").update(payload).eq("id", existing)
        : db.from("properties").insert(payload)
    )
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath(`/properties/${data.id}`);
    return `/properties/${data.id}`;
  });
}
export async function saveModelAction(f: FormData) {
  return run(async () => {
    await Policies.projectWrite();
    const db = createAdminClient();
    const propertyId = id(f, "property_id");
    const modelId = optionalText(f.get("model_id"));
    const units = numberValue(f.get("capacity_units"), "Capacity", {
      min: 1,
      max: 10000,
    });
    if (!Number.isInteger(units))
      throw new Error("Capacity must be a whole number.");
    const captured = date(f, "captured_on");
    if (captured > todayInNewYork())
      throw new Error("Capture date cannot be in the future.");
    const payload = {
      property_id: propertyId,
      name: requiredText(f.get("name"), "Model name"),
      model_url: safeModelUrl(requiredText(f.get("model_url"), "Model URL")),
      captured_on: captured,
      visibility: pick(f, "visibility", ["guest_facing", "internal"]),
      capacity_units: units,
      hosted: f.get("hosted") === "on",
      notes: optionalText(f.get("notes")),
    };
    const q = modelId
      ? db
          .from("digital_twin_models")
          .update(payload)
          .eq("id", id(f, "model_id"))
          .eq("property_id", propertyId)
      : db.from("digital_twin_models").insert(payload);
    const { error } = await q.select("id").single();
    if (error) throw error;
    revalidatePath(`/properties/${propertyId}`);
  });
}
export async function createAgreementAction(f: FormData) {
  await Policies.projectWrite();
  const { data, error } = await createAdminClient().rpc(
    "create_service_agreement",
    { p_revision_id: id(f, "revision_id") },
  );
  if (error) throw error;
  revalidatePath("/services");
  redirect(`/services/${data}`);
}
export async function setCoverageAction(f: FormData) {
  return run(async () => {
    await Policies.projectWrite();
    const db = createAdminClient();
    const agreementId = id(f, "agreement_id");
    const { error } = await db.rpc("set_service_coverage", {
      p_agreement_id: agreementId,
      p_property_id: id(f, "property_id"),
      p_remove: f.get("remove") === "true",
    });
    if (error) throw error;
    revalidatePath(`/services/${agreementId}`);
  });
}
export async function activateAgreementAction(f: FormData) {
  return run(async () => {
    await Policies.projectWrite();
    if (f.get("confirmed") !== "on")
      throw new Error("Confirm the start date and covered scope.");
    const agreementId = id(f, "agreement_id");
    const { error } = await createAdminClient().rpc(
      "activate_service_agreement",
      { p_agreement_id: agreementId, p_starts_on: date(f, "starts_on") },
    );
    if (error) throw error;
    revalidatePath(`/services/${agreementId}`);
  });
}
export async function cancelAgreementAction(f: FormData) {
  return run(async () => {
    await Policies.projectWrite();
    if (f.get("confirmed") !== "on") throw new Error("Confirm cancellation.");
    const agreementId = id(f, "agreement_id");
    const { error } = await createAdminClient().rpc(
      "cancel_service_agreement",
      { p_agreement_id: agreementId },
    );
    if (error) throw error;
    revalidatePath(`/services/${agreementId}`);
  });
}
export async function generateServiceInvoicesAction(f: FormData) {
  return run(async () => {
    await Policies.invoiceCreate();
    const agreementId = id(f, "agreement_id");
    const { error } = await createAdminClient().rpc(
      "generate_service_invoices",
      { p_agreement_id: agreementId },
    );
    if (error) throw error;
    revalidatePath(`/services/${agreementId}`);
  });
}
export async function saveServiceWorkAction(f: FormData) {
  return run(async () => {
    const { appUser } = await Policies.timeOwn();
    const db = createAdminClient();
    const agreementId = id(f, "agreement_id");
    const { data: a, error: ae } = await db
      .from("service_agreements")
      .select("starts_on,ends_on,cancelled_on,status")
      .eq("id", agreementId)
      .single();
    if (ae) throw ae;
    const workDate = date(f, "work_date");
    if (
      a.status === "draft" ||
      workDate < a.starts_on ||
      workDate >= a.ends_on ||
      workDate > todayInNewYork() ||
      (a.cancelled_on && workDate > a.cancelled_on)
    )
      throw new Error(
        "Work date must fall within the service term and cannot be in the future.",
      );
    const minutes = numberValue(f.get("minutes"), "Minutes", {
      min: 1,
      max: 1440,
    });
    if (!Number.isInteger(minutes)) throw new Error("Enter whole minutes.");
    const { error } = await db
      .from("service_work_entries")
      .insert({
        agreement_id: agreementId,
        work_date: workDate,
        minutes,
        description: requiredText(f.get("description"), "Description"),
        created_by: appUser.id,
      });
    if (error) throw error;
    revalidatePath(`/services/${agreementId}`);
  });
}
export async function saveRefreshAction(f: FormData) {
  return run(async () => {
    await Policies.projectWrite();
    const db = createAdminClient();
    const agreementId = id(f, "agreement_id");
    const { data: a, error: ae } = await db
      .from("service_agreements")
      .select("starts_on,ends_on,status")
      .eq("id", agreementId)
      .single();
    if (ae) throw ae;
    const due = date(f, "due_on");
    if (a.status !== "active" || due < a.starts_on || due >= a.ends_on)
      throw new Error("Schedule the visit within the active agreement term.");
    const { error } = await db
      .from("service_refresh_tasks")
      .insert({
        agreement_id: agreementId,
        due_on: due,
        scope: requiredText(f.get("scope"), "Refresh scope"),
      });
    if (error) throw error;
    revalidatePath(`/services/${agreementId}`);
  });
}
export async function completeRefreshAction(f: FormData) {
  return run(async () => {
    await Policies.projectWrite();
    const agreementId = id(f, "agreement_id");
    const status = pick(f, "status", ["complete", "cancelled"]);
    const { error } = await createAdminClient()
      .from("service_refresh_tasks")
      .update({
        status,
        completed_on: status === "complete" ? todayInNewYork() : null,
      })
      .eq("id", id(f, "task_id"))
      .eq("agreement_id", agreementId)
      .eq("status", "planned")
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath(`/services/${agreementId}`);
  });
}
