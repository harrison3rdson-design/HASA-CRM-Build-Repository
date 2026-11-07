"use client";

import { useState } from "react";
import { createInvoiceAction } from "@/app/actions/invoices";
import { PAYMENT_TERMS, type PaymentTerms } from "@/lib/payment-terms";
import { getPaymentTermDays } from "@/lib/invoices/due-date";

type ProjectOption = {
  id: string;
  project_number: string;
  project_name: string;
  payment_terms: PaymentTerms;
  billing_method: string;
  authorized_fee: number;
  service_fee_authorized: number;
};

type ContactOption = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  mobile_phone: string | null;
  is_primary: boolean;
};

type ClientOption = {
  id: string;
  client_number: number;
  company_name: string;
  contacts: ContactOption[];
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function InvoiceForm({
  projects,
  clients,
  defaultPaymentTerms,
  invoiceDate,
  selectedProjectId,
}: {
  projects: ProjectOption[];
  clients: ClientOption[];
  defaultPaymentTerms: PaymentTerms;
  invoiceDate: string;
  selectedProjectId?: string;
}) {
  const [invoiceMode, setInvoiceMode] = useState<"project" | "standalone">("project");
  const [activeProjectId, setActiveProjectId] = useState(selectedProjectId ?? "");
  const selectedProject = projects.find((project) => project.id === activeProjectId);
  const [selectedClientId, setSelectedClientId] = useState("");
  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>(
    selectedProject?.payment_terms ?? defaultPaymentTerms,
  );
  const [invoiceType, setInvoiceType] = useState("progress");
  const [advanceMethod, setAdvanceMethod] = useState("percentage");
  const [advanceValue, setAdvanceValue] = useState("25");
  const numericAdvanceValue = Number(advanceValue);
  const advancePreview = selectedProject && numericAdvanceValue > 0
    ? advanceMethod === "percentage"
      ? selectedProject.service_fee_authorized * numericAdvanceValue / 100
      : numericAdvanceValue
    : 0;

  function selectMode(mode: "project" | "standalone") {
    setInvoiceMode(mode);
    setPaymentTerms(mode === "project"
      ? selectedProject?.payment_terms ?? defaultPaymentTerms
      : defaultPaymentTerms);
  }

  return (
    <form action={createInvoiceAction} className="form-grid">
      <input type="hidden" name="invoice_mode" value={invoiceMode} />
      <fieldset className="billing-workflow full">
        <legend>Invoice source</legend>
        <label className="check">
          <input type="radio" name="invoice_source_choice" checked={invoiceMode === "project"} onChange={() => selectMode("project")} />
          Approved project
        </label>
        <label className="check">
          <input type="radio" name="invoice_source_choice" checked={invoiceMode === "standalone"} onChange={() => selectMode("standalone")} />
          Direct client invoice — no approved project
        </label>
      </fieldset>

      {invoiceMode === "project" ? <>
        {selectedProject && selectedProjectId ? <>
          <input type="hidden" name="project_id" value={selectedProject.id} />
          <div className="project-context"><span>Project</span><strong>{selectedProject.project_number} — {selectedProject.project_name}</strong><small>Client and payment terms are inherited from this project.</small></div>
        </> : <label>Project
          <select
            name="project_id"
            value={activeProjectId}
            required
            onChange={(event) => {
              const project = projects.find((item) => item.id === event.target.value);
              setActiveProjectId(event.target.value);
              setPaymentTerms(project?.payment_terms ?? defaultPaymentTerms);
            }}
          >
            <option value="">Select project</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.project_number} — {project.project_name}</option>)}
          </select>
        </label>}
        <label>Invoice Type
          <select name="invoice_type" value={invoiceType} onChange={(event) => setInvoiceType(event.target.value)}>
            <option value="advance">Advance</option>
            <option value="progress">Progress</option>
            <option value="final">Final</option>
          </select>
          <span>The invoice type controls which approved project amounts are brought into the draft.</span>
        </label>
      </> : <>
        <label>Client
          <select
            name="client_id"
            value={selectedClientId}
            required
            onChange={(event) => {
              const clientId = event.target.value;
              const client = clients.find((item) => item.id === clientId);
              setSelectedClientId(clientId);
              setSelectedContactId(client?.contacts[0]?.id ?? "");
            }}
          >
            <option value="">Select client</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}
          </select>
        </label>
        <label>Billing Contact
          <select
            name="contact_id"
            value={selectedContactId}
            required
            disabled={!selectedClient}
            onChange={(event) => setSelectedContactId(event.target.value)}
          >
            <option value="">Select contact</option>
            {(selectedClient?.contacts ?? []).map((contact) => (
              <option key={contact.id} value={contact.id}>
                {[contact.first_name, contact.last_name].filter(Boolean).join(" ")}
                {contact.is_primary ? " — Primary" : ""}
              </option>
            ))}
          </select>
          <span>This contact receives the invoice by email or text.</span>
        </label>
        <div className="project-context full">
          <span>Direct Invoice</span>
          <strong>Not tied to an approved project</strong>
          <small>After creating the draft, add services, expenses, credits, or adjustments as line items.</small>
        </div>
      </>}

      <label>Invoice Date<input name="invoice_date" type="date" defaultValue={invoiceDate} required /></label>
      <label>Payment Terms
        <select name="payment_terms" value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value as PaymentTerms)} required>
          {PAYMENT_TERMS.map((terms) => <option key={terms} value={terms}>{terms}</option>)}
        </select>
        <span>{invoiceMode === "project" ? "Defaults from the accepted proposal revision." : "Defaults from company settings."}</span>
      </label>
      <div className="project-context">
        <span>Due Date</span>
        <strong>Calculated when sent</strong>
        <small>{paymentTerms} means {getPaymentTermDays(paymentTerms)} calendar days after the invoice is sent.</small>
      </div>
      {invoiceMode === "project" && selectedProject ? <div className="project-context full">
        <span>Approved Billing Basis</span>
        <strong>{selectedProject.billing_method.replaceAll("_", " ")} · {money.format(selectedProject.service_fee_authorized)} authorized services</strong>
        <small>Authorized materials and reimbursable expenses are tracked separately from the service fee.</small>
      </div> : null}
      <label className="full">Customer Notes<textarea name="customer_notes" rows={3} /></label>

      {invoiceMode === "project" && invoiceType === "advance" ? <fieldset className="billing-workflow full">
        <legend>Advance payment</legend>
        <p>Enter a deposit amount or a percentage of the authorized service fee. Time and expenses are not pulled into an Advance invoice.</p>
        <div className="billing-workflow-fields">
          <label>Calculation
            <select name="advance_method" value={advanceMethod} onChange={(event) => setAdvanceMethod(event.target.value)}>
              <option value="percentage">Percentage</option>
              <option value="amount">Dollar amount</option>
            </select>
          </label>
          <label>{advanceMethod === "percentage" ? "Percentage" : "Advance Amount"}
            <input name="advance_value" type="number" min="0.01" max={advanceMethod === "percentage" ? "100" : undefined} step="0.01" value={advanceValue} onChange={(event) => setAdvanceValue(event.target.value)} required />
            <span>Draft advance: {money.format(advancePreview)}</span>
          </label>
        </div>
      </fieldset> : null}
      {invoiceMode === "project" && invoiceType === "progress" ? <fieldset className="billing-workflow full">
        <legend>Progress billing</legend>
        <p>Choose which completed, unbilled project activity to include. Each included entry is reserved so it cannot be billed twice.</p>
        <label className="check"><input name="include_time" type="checkbox" defaultChecked /> Include unbilled time</label>
        <label className="check"><input name="include_unit_work" type="checkbox" defaultChecked /> Include unbilled per-unit work</label>
        <label className="check"><input name="include_expenses" type="checkbox" defaultChecked /> Include unbilled expenses and materials</label>
      </fieldset> : null}
      {invoiceMode === "project" && invoiceType === "final" ? <div className="billing-workflow full" role="note">
        <strong>Final project closeout</strong>
        <p>{selectedProject?.billing_method === "fixed_fee" || selectedProject?.billing_method === "milestone"
          ? "Bills the remaining authorized service balance, includes all remaining billable expenses and materials, and records unbilled time and per-unit work as included fixed-fee detail. Prior non-void invoices are deducted automatically."
          : "Bills all remaining unbilled time, per-unit work, expenses, and materials. Prior non-void invoices remain visible in the reconciliation."}</p>
      </div> : null}
      {invoiceMode === "project" ? <>
        <label className="check"><input name="include_expense_detail" type="checkbox" /> Include Expense Detail</label>
        <label className="check"><input name="include_receipt_appendix" type="checkbox" /> Include Receipt Appendix</label>
      </> : null}
      <div className="full"><button className="primary-button" type="submit">Create Draft Invoice</button></div>
    </form>
  );
}
