import Link from "next/link";
import { Panel } from "@/components/cards";
import { ExpenseForm } from "@/components/forms/expense-form";
import { getExpenses, getProjectWorkOptions } from "@/lib/data/app-data";
import { money } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

function sourceLabel(expense: any) {
  const item = Array.isArray(expense.source_additional_service_expense_item)
    ? expense.source_additional_service_expense_item[0]
    : expense.source_additional_service_expense_item;
  const authorization = Array.isArray(item?.additional_service)
    ? item.additional_service[0]
    : item?.additional_service;
  return authorization?.authorization_number
    ?? (expense.source_material_id ? "Original Proposal Materials" : expense.source_estimate_id ? "Original Proposal" : "Manual");
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const [rows, projects] = await Promise.all([getExpenses(), getProjectWorkOptions()]);
  const expenseDate = new Date().toISOString().slice(0, 10);
  const returnTo = projectId ? `/projects/${projectId}` : undefined;

  return <>
    <div className="page-heading">
      <div><h1>Expenses and Materials</h1><p>Record project purchases and reimbursable expenses, then calculate the billable amount.</p></div>
      <Link className="primary-button" href="#add-expense">Add Expense or Material</Link>
    </div>
    <div id="add-expense">
      <Panel title={projectId ? "Add Expense to Project" : "New Expense"}>
        <ExpenseForm projects={projects} selectedProjectId={projectId} expenseDate={expenseDate} returnTo={returnTo} />
      </Panel>
    </div>
    <Panel title="Recent Expenses">
      <div className="table-wrap"><table><thead><tr><th>Date</th><th>Project</th><th>Approved Source</th><th>Category</th><th>Vendor</th><th>Actual</th><th>Billable</th><th>Rule</th></tr></thead><tbody>{rows.map((x:any)=><tr key={x.id}><td>{x.expense_date}</td><td>{x.project?.project_number??"—"}</td><td>{sourceLabel(x)}</td><td>{x.category}</td><td>{x.vendor??"—"}</td><td>{money(x.actual_cost)}</td><td>{money(x.billable_amount)}</td><td><span className="pill">{x.billing_rule}</span></td></tr>)}</tbody></table></div>
    </Panel>
  </>;
}
