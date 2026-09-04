import { money, hours } from "@/lib/ui/format";

export function ProjectSummary({ financial }: { financial: any }) {
  if (!financial) return null;
  return (
    <div className="summary-grid">
      <div><span>Authorized Fee</span><strong>{money(financial.authorized_fee)}</strong></div>
      <div><span>Hours Worked</span><strong>{hours(financial.total_hours_worked)}</strong></div>
      <div><span>Completed Unit Work</span><strong>{money(financial.billable_unit_value)}</strong></div>
      <div><span>Actual Expenses</span><strong>{money(financial.actual_expenses)}</strong></div>
      <div><span>Total Invoiced</span><strong>{money(financial.total_invoiced)}</strong></div>
      <div><span>Payments</span><strong>{money(financial.payments_received)}</strong></div>
      <div><span>Outstanding A/R</span><strong>{money(financial.outstanding_ar)}</strong></div>
      <div><span>Remaining Authorized Fee</span><strong>{money(financial.remaining_authorized_fee)}</strong></div>
      <div><span>Est. Margin*</span><strong>{money(financial.estimated_gross_margin_before_overhead)}</strong></div>
    </div>
  );
}
