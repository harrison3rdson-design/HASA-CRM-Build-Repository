import { updateClientAction } from "@/app/actions/clients";

type EditableClient = {
  id: string;
  company_name: string;
  billing_name: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
  active: boolean;
};

export function ClientEditForm({ client }: { client: EditableClient }) {
  return (
    <form action={updateClientAction} className="form-grid">
      <input name="client_id" type="hidden" value={client.id} />
      <label>Company Name<input name="company_name" defaultValue={client.company_name} required /></label>
      <label>Billing Name<input name="billing_name" defaultValue={client.billing_name ?? ""} /></label>
      <label>Email<input name="email" type="email" defaultValue={client.email ?? ""} /></label>
      <label>Phone<input name="phone" type="tel" defaultValue={client.phone ?? ""} /></label>
      <label>Address<input name="address_line_1" defaultValue={client.address_line_1 ?? ""} /></label>
      <label>Address 2<input name="address_line_2" defaultValue={client.address_line_2 ?? ""} /></label>
      <label>City<input name="city" defaultValue={client.city ?? ""} /></label>
      <label>State<input name="state" defaultValue={client.state ?? ""} /></label>
      <label>Postal Code<input name="postal_code" defaultValue={client.postal_code ?? ""} /></label>
      <label>Country<input name="country" defaultValue={client.country ?? ""} /></label>
      <label className="check"><input name="active" type="checkbox" defaultChecked={client.active} /> Active Client</label>
      <label className="full">Notes<textarea name="notes" rows={4} defaultValue={client.notes ?? ""} /></label>
      <div className="full"><button className="primary-button" type="submit">Save Client Changes</button></div>
    </form>
  );
}
