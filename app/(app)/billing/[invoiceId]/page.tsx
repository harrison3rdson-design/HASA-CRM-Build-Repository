import Link from "next/link";
import { Panel } from "@/components/cards";
import { InvoiceSummary } from "@/components/billing/invoice-summary";
import { DeleteInvoiceButton } from "@/components/billing/delete-invoice-button";
import { SendAndLockInvoiceForm } from "@/components/billing/send-and-lock-invoice-form";
import { PaymentForm } from "@/components/forms/payment-form";
import { getInvoiceDetail } from "@/lib/data/detail-data";
import { isTransactionalEmailConfigured } from "@/lib/messaging/email";
import { isTwilioConfigured } from "@/lib/messaging/twilio";
import { normalizeRelatedContact } from "@/lib/proposal-contacts";
import { money } from "@/lib/ui/format";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const d = await getInvoiceDetail(invoiceId);
  const primaryContact = normalizeRelatedContact(d.invoice.project?.primary_contact);
  const canSendInvoice = !d.invoice.sent_at
    && (d.invoice.status === "draft" || d.invoice.status === "issued");
  const canDeleteDraft = d.invoice.status === "draft"
    && !d.invoice.locked
    && !d.invoice.issued_at
    && !d.invoice.sent_at
    && d.payments.length === 0
    && d.invoice.invoice_number === d.latestProjectInvoiceNumber;

  return (
    <>
      <div className="page-heading">
        <div><h1>Invoice {d.invoice.invoice_number}</h1><p>{d.invoice.client?.company_name} · {d.invoice.project?.project_name}</p></div>
        <div className="button-row">
          <Link
            className="secondary-button"
            href={`/api/invoices/${invoiceId}/preview`}
            target="_blank"
            rel="noreferrer"
          >
            Preview Customer PDF
          </Link>
          {canDeleteDraft ? (
            <DeleteInvoiceButton
              invoiceId={invoiceId}
              invoiceNumber={d.invoice.invoice_number}
              projectId={d.invoice.project_id}
            />
          ) : null}
        </div>
      </div>

      <InvoiceSummary invoice={d.invoice} />

      {canSendInvoice ? (
        <Panel title="Send Invoice">
          <SendAndLockInvoiceForm
            invoiceId={invoiceId}
            hasEmail={Boolean(primaryContact?.email)}
            hasMobile={Boolean(primaryContact?.mobile_phone)}
            emailConfigured={isTransactionalEmailConfigured()}
            smsConfigured={isTwilioConfigured()}
          />
        </Panel>
      ) : null}

      <Panel title="Line Items">
        {d.items.length ? <div className="table-wrap"><table><thead><tr><th>Description</th><th>Type</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>{d.items.map((i:any)=><tr key={i.id}><td>{i.description}</td><td>{i.item_type}</td><td>{i.quantity}</td><td>{money(i.rate)}</td><td>{money(i.amount)}</td></tr>)}</tbody></table></div>
        : <p className="muted">No unbilled time or expenses were available. This draft has no line items yet.</p>}
      </Panel>

      <div className="two-column">
        <Panel title="Record Payment">
          <PaymentForm invoiceId={invoiceId} />
        </Panel>

        <Panel title="Invoice Details">
          <p><strong>Date:</strong> {d.invoice.invoice_date}</p>
          <p><strong>Due:</strong> {d.invoice.due_date ?? `Calculated when sent (${d.invoice.payment_terms})`}</p>
          <p><strong>Terms:</strong> {d.invoice.payment_terms}</p>
          <p><strong>Receipt Appendix:</strong> {d.invoice.include_receipt_appendix ? "Yes" : "No"}</p>
        </Panel>
      </div>

      <Panel title="Payments">
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead>
        <tbody>{d.payments.map((p:any)=><tr key={p.id}><td>{p.payment_date}</td><td>{money(p.amount)}</td><td>{p.payment_method}</td><td>{p.reference_number??"—"}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel title="Delivery History">
        <div className="table-wrap"><table><thead><tr><th>Method</th><th>Recipient</th><th>Status</th><th>Sent</th></tr></thead>
        <tbody>{d.deliveries.map((x:any)=><tr key={x.id}><td>{x.delivery_method}</td><td>{x.recipient_address}</td><td>{x.status}</td><td>{x.sent_at??"—"}</td></tr>)}</tbody></table></div>
      </Panel>
    </>
  );
}
