import { money } from "@/lib/ui/format";

export function InvoiceSummary({ invoice }: { invoice: any }) {
  return (
    <div className="summary-grid">
      <div><span>Total</span><strong>{money(invoice.total)}</strong></div>
      <div><span>Paid</span><strong>{money(invoice.amount_paid)}</strong></div>
      <div><span>Balance Due</span><strong>{money(invoice.balance_due)}</strong></div>
      <div><span>Status</span><strong className="capitalize">{invoice.status}</strong></div>
    </div>
  );
}
