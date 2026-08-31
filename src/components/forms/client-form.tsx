import { createClientAction } from "@/app/actions/clients";

export function ClientForm() {
  return (
    <form action={createClientAction} className="form-grid">
      <label>Company Name<input name="company_name" required /></label>
      <label>Billing Name<input name="billing_name" /></label>
      <label>Email<input name="email" type="email" /></label>
      <label>Phone<input name="phone" /></label>
      <label>Address<input name="address_line_1" /></label>
      <label>Address 2<input name="address_line_2" /></label>
      <label>City<input name="city" /></label>
      <label>State<input name="state" /></label>
      <label>Postal Code<input name="postal_code" /></label>
      <label>Country<input name="country" defaultValue="United States" /></label>
      <label className="full">Notes<textarea name="notes" rows={4} /></label>
      <div className="full"><button className="primary-button" type="submit">Create Client</button></div>
    </form>
  );
}
