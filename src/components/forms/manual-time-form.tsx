"use client";

import { useState } from "react";
import { addManualTimeAction } from "@/app/actions/time";
import type { ProjectWorkOption } from "@/lib/project-work-options";

const FALLBACK_ACTIVITIES = ["Consulting", "Drawing Review", "CAD/Production", "Meeting", "Project Administration", "Travel Time"];

function money(value: number | string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
}

export function ManualTimeForm({
  projects,
  selectedProjectId,
  workDate,
  returnTo,
}: {
  projects: ProjectWorkOption[];
  selectedProjectId?: string;
  workDate?: string;
  returnTo?: string;
}) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const [projectId, setProjectId] = useState(selectedProjectId ?? "");
  const [sourceKey, setSourceKey] = useState(() => {
    const category = selectedProject?.labor_categories[0];
    return category ? `${category.source_kind}:${category.id}` : "";
  });
  const activeProject = projects.find((project) => project.id === projectId);
  const selectedFeeItem = activeProject?.labor_categories.find((item) => `${item.source_kind}:${item.id}` === sourceKey);
  const hasApprovedCategories = Boolean(activeProject?.labor_categories.length);

  function selectProject(nextProjectId: string) {
    const project = projects.find((item) => item.id === nextProjectId);
    setProjectId(nextProjectId);
    const category = project?.labor_categories[0];
    setSourceKey(category ? `${category.source_kind}:${category.id}` : "");
  }

  return (
    <form action={addManualTimeAction} className="form-grid">
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
      <label>Date<input name="work_date" type="date" defaultValue={workDate} required /></label>
      {hasApprovedCategories ? <>
        <label>Approved Labor Category
          <select name="approved_labor_source" value={sourceKey} required onChange={(event) => setSourceKey(event.target.value)}>
            {activeProject?.labor_categories.map((item) => <option key={`${item.source_kind}:${item.id}`} value={`${item.source_kind}:${item.id}`}>{item.source_label} — {item.description}</option>)}
          </select>
          <span>From the accepted proposal or an accepted Additional Service.</span>
        </label>
        <div className="project-context"><span>Billing Rate</span><strong>{selectedFeeItem ? `${money(selectedFeeItem.rate)} / hour` : "—"}</strong><small>Inherited and preserved with this time entry</small></div>
      </> : <>
        <label>Activity
          <select name="activity_type" required defaultValue="Consulting">
            {FALLBACK_ACTIVITIES.map((activity) => <option key={activity}>{activity}</option>)}
          </select>
          <span>No approved labor categories are available for this project.</span>
        </label>
        <label>Billing Rate<input name="billing_rate" type="number" min="0" step="0.01" /></label>
      </>}
      <label>Hours
        <input name="hours" type="number" min="0.5" step="0.5" required />
        <span>Recorded in half-hour increments; other values round up.</span>
      </label>
      <label className="full">Description<textarea name="description" rows={3} /></label>
      <label className="check"><input name="billable" type="checkbox" defaultChecked /> Billable</label>
      <label className="check"><input name="is_travel_time" type="checkbox" /> Travel Time</label>
      <div className="full"><button className="primary-button" type="submit">Save Time</button></div>
    </form>
  );
}
