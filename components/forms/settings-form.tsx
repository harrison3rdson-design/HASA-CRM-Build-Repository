import { updateCompanySettingsAction } from "@/app/actions/settings";

export function SettingsForm({ settings }: { settings: any }) {
  return (
    <form action={updateCompanySettingsAction} className="form-grid">
      <label>Legal Name<input name="legal_name" defaultValue={settings.legal_name} required /></label>
      <label>Display Name<input name="display_name" defaultValue={settings.display_name} required /></label>
      <label>Phone<input name="phone" defaultValue={settings.phone ?? ""} /></label>
      <label>Email<input name="email" type="email" defaultValue={settings.email ?? ""} /></label>
      <label>Website<input name="website" defaultValue={settings.website ?? ""} /></label>
      <label>Default Terms<input name="default_payment_terms" defaultValue={settings.default_payment_terms ?? "NET 15"} required /></label>
      <label>Currency<input name="default_currency" defaultValue={settings.default_currency ?? "USD"} required /></label>
      <label>Horizontal Logo Path<input name="logo_horizontal_path" defaultValue={settings.logo_horizontal_path ?? ""} /></label>
      <label>Square Logo Path<input name="logo_square_path" defaultValue={settings.logo_square_path ?? ""} /></label>
      <label className="full">Proposal Footer<textarea name="proposal_footer" rows={2} defaultValue={settings.proposal_footer ?? ""} /></label>
      <label className="full">Invoice Footer<textarea name="invoice_footer" rows={2} defaultValue={settings.invoice_footer ?? ""} /></label>
      <div className="full"><button className="primary-button" type="submit">Save Settings</button></div>
    </form>
  );
}
