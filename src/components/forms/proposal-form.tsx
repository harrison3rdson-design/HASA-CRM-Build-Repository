"use client";

import { useActionState, useState } from "react";
import { createProposalAction } from "@/app/actions/proposals";
import { ProposalLineItemsFields } from "@/components/forms/proposal-line-items-fields";
import { ProposalScopeFields } from "@/components/forms/proposal-scope-fields";
import { PAYMENT_TERMS, type PaymentTerms } from "@/lib/payment-terms";
import {
  proposalContactLabel,
  selectDefaultProposalContact,
  type ProposalContactOption,
} from "@/lib/proposal-contacts";

type ClientOption = {
  id: string;
  client_number: string;
  company_name: string;
  contacts: ProposalContactOption[];
};

export function ProposalForm({
  clients,
  defaultPaymentTerms,
  initialClientId = "",
  initialContactId = "",
}: {
  clients: ClientOption[];
  defaultPaymentTerms: PaymentTerms;
  initialClientId?: string;
  initialContactId?: string;
}) {
  const [selectedClientId, setSelectedClientId] = useState(initialClientId);
  const [selectedContactId, setSelectedContactId] = useState(initialContactId);
  const [state, formAction, pending] = useActionState(createProposalAction, {
    status: "idle" as const,
    message: "",
  });
  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const contacts = selectedClient?.contacts ?? [];

  return (
    <form action={formAction} className="form-grid">
      {initialClientId ? (
        <div className="full inherited-selection-note" role="status">
          <strong>Client details inherited</strong>
          <span>The Client and Primary Contact were selected from the client record. You can change either selection before creating the proposal.</span>
        </div>
      ) : null}
      <label>
        Proposal Number
        <input value="Assigned automatically when saved" readOnly aria-describedby="proposal-number-help" />
        <span id="proposal-number-help">Annual sequence: YYYY0151, YYYY0152, YYYY0153…</span>
      </label>
      <label>
        Client
        <select
          name="client_id"
          required
          value={selectedClientId}
          onChange={(event) => {
            const clientId = event.target.value;
            const client = clients.find((option) => option.id === clientId);
            setSelectedClientId(clientId);
            setSelectedContactId(selectDefaultProposalContact(client?.contacts ?? [])?.id ?? "");
          }}
        >
          <option value="">Select client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.client_number} — {client.company_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Primary Contact
        <select
          name="primary_contact_id"
          value={selectedContactId}
          disabled={!selectedClientId || !contacts.length}
          onChange={(event) => setSelectedContactId(event.target.value)}
        >
          <option value="">
            {!selectedClientId ? "Select a client first" : contacts.length ? "Select contact" : "No contacts available"}
          </option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {proposalContactLabel(contact)}
            </option>
          ))}
        </select>
        <span>The Client’s primary contact is selected automatically.</span>
      </label>
      <label>
        Project Name
        <input name="project_name" required />
      </label>
      <label>
        Project Location
        <input name="project_location" />
      </label>
      <label>
        Payment Terms
        <select name="payment_terms" defaultValue={defaultPaymentTerms} required>
          {PAYMENT_TERMS.map((terms) => <option key={terms} value={terms}>{terms}</option>)}
        </select>
      </label>
      <label>
        Validity (Days)
        <input name="validity_days" type="number" min="1" defaultValue="90" required />
      </label>
      <label>
        Billing Method
        <select name="billing_method" defaultValue="fixed_fee">
          <option value="fixed_fee">Fixed fee</option>
          <option value="hourly">Hourly</option>
          <option value="milestone">Milestone</option>
          <option value="time_and_materials">Time and materials</option>
        </select>
      </label>

      <ProposalScopeFields />

      <ProposalLineItemsFields />

      <div className="full form-submit-row">
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create Proposal"}
        </button>
        {state.message ? (
          <p className="form-message error" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
