"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/server";
import { requiredText, optionalText } from "@/lib/validation/common";
import { parsePaymentTerms } from "@/lib/payment-terms";

export async function updateCompanySettingsAction(formData: FormData) {
  const { supabase } = await requireUser();

  const { data: current, error: readError } = await supabase
    .from("company_settings")
    .select("id")
    .limit(1)
    .single();

  if (readError) throw readError;

  const { error } = await supabase
    .from("company_settings")
    .update({
      legal_name: requiredText(formData.get("legal_name"), "Legal name"),
      display_name: requiredText(formData.get("display_name"), "Display name"),
      phone: optionalText(formData.get("phone")),
      email: optionalText(formData.get("email")),
      website: optionalText(formData.get("website")),
      default_payment_terms: parsePaymentTerms(formData.get("default_payment_terms"), "Default payment terms"),
      default_currency: requiredText(formData.get("default_currency"), "Currency"),
      logo_horizontal_path: optionalText(formData.get("logo_horizontal_path")),
      logo_square_path: optionalText(formData.get("logo_square_path")),
      proposal_footer: optionalText(formData.get("proposal_footer")),
      invoice_footer: optionalText(formData.get("invoice_footer")),
    })
    .eq("id", current.id);

  if (error) throw error;
  revalidatePath("/settings");
}
