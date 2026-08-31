"use client";

import { useActionState } from "react";
import { updateCompanySettingsAction } from "@/app/actions/settings";
import { PAYMENT_TERMS } from "@/lib/payment-terms";

export function SettingsForm({ settings }: { settings: any }) {
  const [state, formAction, pending] = useActionState(updateCompanySettingsAction, {
    status: "idle" as const,
    message: "",
  });

  return (
    <form action={formAction} className="form-grid">
      <label>Legal Name<input name="legal_name" defaultValue={settings.legal_name} required /></label>
      <label>Display Name<input name="display_name" defaultValue={settings.display_name} required /></label>
      <label>Phone<input name="phone" defaultValue={settings.phone ?? ""} /></label>
      <label>Email<input name="email" type="email" defaultValue={settings.email ?? ""} /></label>
      <label>Website<input name="website" defaultValue={settings.website ?? ""} /></label>
      <label>Default Payment Terms
        <select name="default_payment_terms" defaultValue={settings.default_payment_terms ?? "NET 15"} required>
          {PAYMENT_TERMS.map((terms) => <option key={terms} value={terms}>{terms}</option>)}
        </select>
      </label>
      <label>Currency<input name="default_currency" defaultValue={settings.default_currency ?? "USD"} required /></label>
      <label>Horizontal Logo Path<input name="logo_horizontal_path" defaultValue={settings.logo_horizontal_path ?? ""} /></label>
      <label>Square Logo Path<input name="logo_square_path" defaultValue={settings.logo_square_path ?? ""} /></label>
      <label className="full">Proposal Footer<textarea name="proposal_footer" rows={2} defaultValue={settings.proposal_footer ?? ""} /></label>
      <label className="full">Invoice Footer<textarea name="invoice_footer" rows={2} defaultValue={settings.invoice_footer ?? ""} /></label>
      <div className="full form-submit-row">
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save Settings"}
        </button>
        {state.message ? (
          <p className={`form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
