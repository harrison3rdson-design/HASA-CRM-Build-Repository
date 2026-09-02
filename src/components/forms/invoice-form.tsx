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

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function InvoiceForm({
  projects,
  defaultPaymentTerms,
  invoiceDate,
  selectedProjectId,
}: {
  projects: ProjectOption[];
  defaultPaymentTerms: PaymentTerms;
  invoiceDate: string;
  selectedProjectId?: string;
}) {
  const [activeProjectId, setActiveProjectId] = useState(selectedProjectId ?? "");
  const selectedProject = projects.find((project) => project.id === activeProjectId);
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

  return (
    <form action={createInvoiceAction} className="form-grid">
      {selectedProject ? <>
        <input type="hidden" name="project_id" value={selectedProject.id} />
        <div className="project-context"><span>Project</span><strong>{selectedProject.project_number} — {selectedProject.project_name}</strong><small>Client and payment terms are inherited from this project</small></div>
      </> : <label>Project
        <select
          name="project_id"
          defaultValue={selectedProjectId ?? ""}
          required
          onChange={(event) => {
            const project = projects.find((item) => item.id === event.target.value);
            setActiveProjectId(event.target.value);
            setPaymentTerms(project?.payment_terms ?? defaultPaymentTerms);
          }}
        >
          <option value="">Select project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.project_name}</option>)}
        </select>
      </label>}
      <label>Invoice Type
        <select name="invoice_type" value={invoiceType} onChange={(event) => setInvoiceType(event.target.value)}>
          <option value="advance">Advance</option>
          <option value="progress">Progress</option>
          <option value="final">Final</option>
        </select>
        <span>The invoice type controls which amounts are brought into the draft.</span>
      </label>
      <label>Invoice Date<input name="invoice_date" type="date" defaultValue={invoiceDate} required /></label>
      <label>Payment Terms
        <select
          name="payment_terms"
          value={paymentTerms}
          onChange={(event) => setPaymentTerms(event.target.value as PaymentTerms)}
          required
        >
          {PAYMENT_TERMS.map((terms) => <option key={terms} value={terms}>{terms}</option>)}
        </select>
        <span>Defaults from the accepted proposal revision for the selected project.</span>
      </label>
      <div className="project-context">
        <span>Due Date</span>
        <strong>Calculated when sent</strong>
        <small>{paymentTerms} means {getPaymentTermDays(paymentTerms)} calendar days after the invoice is sent to the customer.</small>
      </div>
      {selectedProject ? <div className="project-context full">
        <span>Approved Billing Basis</span>
        <strong>{selectedProject.billing_method.replaceAll("_", " ")} · {money.format(selectedProject.service_fee_authorized)} authorized services</strong>
        <small>{money.format(selectedProject.authorized_fee - selectedProject.service_fee_authorized)} of authorized reimbursable expenses is tracked separately.</small>
      </div> : null}
      <label className="full">Customer Notes<textarea name="customer_notes" rows={3} /></label>
      {invoiceType === "advance" ? <fieldset className="billing-workflow full">
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
            <input
              name="advance_value"
              type="number"
              min="0.01"
              max={advanceMethod === "percentage" ? "100" : undefined}
              step="0.01"
              value={advanceValue}
              onChange={(event) => setAdvanceValue(event.target.value)}
              required
            />
            <span>Draft advance: {money.format(advancePreview)}</span>
          </label>
        </div>
      </fieldset> : null}
      {invoiceType === "progress" ? <fieldset className="billing-workflow full">
        <legend>Progress billing</legend>
        <p>Choose which completed, unbilled project activity to include. Each included entry is reserved so it cannot be billed twice.</p>
        <label className="check"><input name="include_time" type="checkbox" defaultChecked /> Include unbilled time</label>
        <label className="check"><input name="include_expenses" type="checkbox" defaultChecked /> Include unbilled expenses</label>
      </fieldset> : null}
      {invoiceType === "final" ? <div className="billing-workflow full" role="note">
        <strong>Final project closeout</strong>
        <p>{selectedProject?.billing_method === "fixed_fee" || selectedProject?.billing_method === "milestone"
          ? "Bills the remaining authorized service balance, includes all remaining billable expenses, and records unbilled time as included fixed-fee detail. Prior non-void invoices are deducted automatically."
          : "Bills all remaining unbilled time and expenses. Prior non-void invoices remain visible in the reconciliation."}</p>
      </div> : null}
      <label className="check"><input name="include_expense_detail" type="checkbox" /> Include Expense Detail</label>
      <label className="check"><input name="include_receipt_appendix" type="checkbox" /> Include Receipt Appendix</label>
      <div className="full"><button className="primary-button" type="submit">Create Draft Invoice</button></div>
    </form>
  );
}
