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
};

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
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>(
    selectedProject?.payment_terms ?? defaultPaymentTerms,
  );

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
            setPaymentTerms(project?.payment_terms ?? defaultPaymentTerms);
          }}
        >
          <option value="">Select project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.project_name}</option>)}
        </select>
      </label>}
      <label>Invoice Type
        <select name="invoice_type" defaultValue="progress">
          {["advance","progress","milestone","hourly","expense","final","credit"].map(x => <option key={x}>{x}</option>)}
        </select>
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
      <label className="full">Customer Notes<textarea name="customer_notes" rows={3} /></label>
      <label className="check full">
        <input name="include_unbilled_work" type="checkbox" defaultChecked />
        Build from Unbilled Time and Expenses
        <span>Creates grouped invoice lines and reserves each source entry so it cannot be billed twice.</span>
      </label>
      <label className="check"><input name="include_expense_detail" type="checkbox" /> Include Expense Detail</label>
      <label className="check"><input name="include_receipt_appendix" type="checkbox" /> Include Receipt Appendix</label>
      <div className="full"><button className="primary-button" type="submit">Create Draft Invoice</button></div>
    </form>
  );
}
