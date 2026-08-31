"use client";

import { useState } from "react";
import { createInvoiceAction } from "@/app/actions/invoices";
import { PAYMENT_TERMS, type PaymentTerms } from "@/lib/payment-terms";

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
}: {
  projects: ProjectOption[];
  defaultPaymentTerms: PaymentTerms;
  invoiceDate: string;
}) {
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>(defaultPaymentTerms);

  return (
    <form action={createInvoiceAction} className="form-grid">
      <label>Project
        <select
          name="project_id"
          required
          onChange={(event) => {
            const project = projects.find((item) => item.id === event.target.value);
            setPaymentTerms(project?.payment_terms ?? defaultPaymentTerms);
          }}
        >
          <option value="">Select project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.project_name}</option>)}
        </select>
      </label>
      <label>Invoice Type
        <select name="invoice_type" defaultValue="progress">
          {["advance","progress","milestone","hourly","expense","final","credit"].map(x => <option key={x}>{x}</option>)}
        </select>
      </label>
      <label>Invoice Date<input name="invoice_date" type="date" defaultValue={invoiceDate} required /></label>
      <label>Due Date<input name="due_date" type="date" /></label>
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
      <label className="full">Customer Notes<textarea name="customer_notes" rows={3} /></label>
      <label className="check"><input name="include_expense_detail" type="checkbox" /> Include Expense Detail</label>
      <label className="check"><input name="include_receipt_appendix" type="checkbox" /> Include Receipt Appendix</label>
      <div className="full"><button className="primary-button" type="submit">Create Draft Invoice</button></div>
    </form>
  );
}
