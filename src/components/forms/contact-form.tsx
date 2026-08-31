import { createContactAction } from "@/app/actions/clients";

export function ContactForm({ clientId }: { clientId: string }) {
  return (
    <form action={createContactAction} className="form-grid">
      <input name="client_id" type="hidden" value={clientId} />
      <label>First Name<input name="first_name" required /></label>
      <label>Last Name<input name="last_name" /></label>
      <label>Title<input name="title" /></label>
      <label>Email<input name="email" type="email" /></label>
      <label>Mobile Phone<input name="mobile_phone" type="tel" /></label>
      <label>Office Phone<input name="office_phone" type="tel" /></label>
      <label className="check"><input name="is_primary" type="checkbox" /> Primary Contact</label>
      <label className="check"><input name="receives_proposals" type="checkbox" defaultChecked /> Receives Proposals</label>
      <label className="check"><input name="receives_invoices" type="checkbox" defaultChecked /> Receives Invoices</label>
      <label className="full">Notes<textarea name="notes" rows={3} /></label>
      <div className="full"><button className="primary-button" type="submit">Add Contact</button></div>
    </form>
  );
}
