import { updateProposalPrimaryContactAction } from "@/app/actions/proposals";
import {
  proposalContactLabel,
  type ProposalContactOption,
} from "@/lib/proposal-contacts";

export function ProposalPrimaryContactForm({
  proposalId,
  contacts,
  primaryContactId,
  locked,
}: {
  proposalId: string;
  contacts: ProposalContactOption[];
  primaryContactId: string;
  locked: boolean;
}) {
  if (!contacts.length) {
    return <p className="form-error">Add a Contact to this Client before sending the proposal.</p>;
  }

  if (locked) {
    const selected = contacts.find((contact) => contact.id === primaryContactId);
    return <p>{selected ? proposalContactLabel(selected) : "No contact assigned"}</p>;
  }

  return (
    <form action={updateProposalPrimaryContactAction} className="form-grid">
      <input name="proposal_id" type="hidden" value={proposalId} />
      <label>
        Primary Contact
        <select name="primary_contact_id" defaultValue={primaryContactId} required>
          <option value="">Select contact</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {proposalContactLabel(contact)}
            </option>
          ))}
        </select>
        <span>This contact receives the proposal by email, text message, or both.</span>
      </label>
      <div className="full">
        <button className="secondary-button" type="submit">Save Contact</button>
      </div>
    </form>
  );
}
