"use client";

import { useState } from "react";
import { createExpenseAction } from "@/app/actions/expenses";
import type { ProjectWorkOption } from "@/lib/project-work-options";

const BILLING_RULES = ["actual", "actual_plus_markup", "fixed_rate", "per_diem", "mileage", "allowance", "included", "not_billable"];

function readableRule(value: string) {
  return value.replaceAll("_", " ");
}

export function ExpenseForm({
  projects,
  selectedProjectId,
  expenseDate,
  returnTo,
}: {
  projects: ProjectWorkOption[];
  selectedProjectId?: string;
  expenseDate?: string;
  returnTo?: string;
}) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const [projectId, setProjectId] = useState(selectedProjectId ?? "");
  const [sourceEstimateId, setSourceEstimateId] = useState(selectedProject?.expense_categories[0]?.id ?? "");
  const activeProject = projects.find((project) => project.id === projectId);
  const selectedEstimate = activeProject?.expense_categories.find((item) => item.id === sourceEstimateId);
  const hasProposalCategories = Boolean(activeProject?.expense_categories.length);

  function selectProject(nextProjectId: string) {
    const project = projects.find((item) => item.id === nextProjectId);
    setProjectId(nextProjectId);
    setSourceEstimateId(project?.expense_categories[0]?.id ?? "");
  }

  return (
    <form action={createExpenseAction} className="form-grid">
      {selectedProject ? <>
        <input type="hidden" name="project_id" value={selectedProject.id} />
        <div className="project-context"><span>Project</span><strong>{selectedProject.project_number} — {selectedProject.project_name}</strong><small>Inherited from the project record</small></div>
      </> : <label>Project
          <select name="project_id" value={projectId} required onChange={(event) => selectProject(event.target.value)}>
            <option value="">Select project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.project_name}</option>)}
          </select>
        </label>}
      {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
      <label>Date<input name="expense_date" type="date" defaultValue={expenseDate} required /></label>
      {hasProposalCategories ? <>
        <label>Proposal Expense Category
          <select name="source_estimate_id" value={sourceEstimateId} required onChange={(event) => setSourceEstimateId(event.target.value)}>
            {activeProject?.expense_categories.map((item) => <option key={item.id} value={item.id}>{item.category}</option>)}
          </select>
          <span>From the accepted proposal.</span>
        </label>
        <div className="project-context"><span>Billing Rule</span><strong>{selectedEstimate ? readableRule(selectedEstimate.billing_rule) : "—"}</strong><small>{selectedEstimate?.requires_receipt ? "Receipt required" : "Receipt optional"}</small></div>
      </> : <>
        <label>Category<input name="category" required /></label>
        <label>Billing Rule
          <select name="billing_rule" defaultValue="actual">
            {BILLING_RULES.map((rule) => <option key={rule} value={rule}>{readableRule(rule)}</option>)}
          </select>
        </label>
        <label>Markup %<input name="markup_percent" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label>Fixed Billable Amount<input name="fixed_billable_amount" type="number" min="0" step="0.01" defaultValue="0" /></label>
      </>}
      <label>Vendor<input name="vendor" /></label>
      <label>Actual Cost<input name="actual_cost" type="number" min="0" step="0.01" required /></label>
      <label className="full">Description<textarea name="description" rows={3} /></label>
      <label className="check"><input name="billable" type="checkbox" defaultChecked /> Billable</label>
      <div className="full"><button className="primary-button" type="submit">Save Expense</button></div>
    </form>
  );
}
