"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/server";
import { requiredText, optionalText } from "@/lib/validation/common";

export async function createClientAction(formData: FormData) {
  const { supabase } = await requireUser();

  const payload = {
    company_name: requiredText(formData.get("company_name"), "Company name"),
    billing_name: optionalText(formData.get("billing_name")),
    email: optionalText(formData.get("email")),
    phone: optionalText(formData.get("phone")),
    address_line_1: optionalText(formData.get("address_line_1")),
    address_line_2: optionalText(formData.get("address_line_2")),
    city: optionalText(formData.get("city")),
    state: optionalText(formData.get("state")),
    postal_code: optionalText(formData.get("postal_code")),
    country: optionalText(formData.get("country")) ?? "United States",
    notes: optionalText(formData.get("notes")),
  };

  const { data, error } = await supabase
    .from("clients")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  revalidatePath("/clients");
  return data.id as string;
}

export async function createContactAction(formData: FormData) {
  const { supabase } = await requireUser();

  const clientId = requiredText(formData.get("client_id"), "Client");
  const payload = {
    client_id: clientId,
    first_name: optionalText(formData.get("first_name")),
    last_name: optionalText(formData.get("last_name")),
    title: optionalText(formData.get("title")),
    email: optionalText(formData.get("email")),
    mobile_phone: optionalText(formData.get("mobile_phone")),
    office_phone: optionalText(formData.get("office_phone")),
    is_primary: formData.get("is_primary") === "on",
    receives_proposals: formData.get("receives_proposals") !== null,
    receives_invoices: formData.get("receives_invoices") !== null,
  };

  const { data, error } = await supabase
    .from("contacts")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return data.id as string;
}
