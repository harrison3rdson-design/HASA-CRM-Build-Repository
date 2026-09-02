import { addManualTimeAction } from "@/app/actions/time";

type ProjectOption = { id: string; project_number: string; project_name: string };

export function ManualTimeForm({
  projects,
  selectedProjectId,
  workDate,
  returnTo,
}: {
  projects: ProjectOption[];
  selectedProjectId?: string;
  workDate?: string;
  returnTo?: string;
}) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  return (
    <form action={addManualTimeAction} className="form-grid">
      {selectedProject ? <>
        <input type="hidden" name="project_id" value={selectedProject.id} />
        <div className="project-context"><span>Project</span><strong>{selectedProject.project_number} — {selectedProject.project_name}</strong><small>Inherited from the project record</small></div>
      </> : <label>Project
          <select name="project_id" defaultValue={selectedProjectId ?? ""} required>
            <option value="">Select project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.project_name}</option>)}
          </select>
        </label>}
      {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
      <label>Date<input name="work_date" type="date" defaultValue={workDate} required /></label>
      <label>Activity
        <select name="activity_type" required defaultValue="Consulting">
          {["Consulting","Drawing Review","CAD/Production","Meeting","Project Administration","Travel Time"].map(x => <option key={x}>{x}</option>)}
        </select>
      </label>
      <label>Hours<input name="hours" type="number" min="0.01" step="0.01" required /></label>
      <label>Billing Rate<input name="billing_rate" type="number" min="0" step="0.01" /></label>
      <label>Internal Cost Rate<input name="internal_cost_rate" type="number" min="0" step="0.01" /></label>
      <label className="full">Description<textarea name="description" rows={3} /></label>
      <label className="check"><input name="billable" type="checkbox" defaultChecked /> Billable</label>
      <label className="check"><input name="is_travel_time" type="checkbox" /> Travel Time</label>
      <div className="full"><button className="primary-button" type="submit">Save Time</button></div>
    </form>
  );
}
