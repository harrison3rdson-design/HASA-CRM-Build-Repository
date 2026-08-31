"use server";

import { revalidatePath } from "next/cache";
import { Policies } from "@/lib/auth/action-policy";
import { requiredText, optionalText } from "@/lib/validation/common";
import { parsePaymentTerms } from "@/lib/payment-terms";

export type SettingsActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function updateCompanySettingsAction(
  _previousState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  try {
    const { supabase } = await Policies.companySettings();

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
      .eq("id", current.id)
      .select("id")
      .single();

    if (error) throw error;
    revalidatePath("/settings");
    return { status: "success", message: "Company settings saved." };
  } catch (error) {
    console.error("[settings:update] failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      status: "error",
      message: error instanceof Error && !error.message.includes("Authentication")
        ? error.message
        : "Unable to save settings. Please sign in again and retry.",
    };
  }
}
