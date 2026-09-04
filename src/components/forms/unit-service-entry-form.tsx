import { addUnitServiceEntryAction } from "@/app/actions/unit-services";
import { money } from "@/lib/ui/format";

type UnitServiceOption = {
  id: string;
  description: string;
  quantity: number | string;
  unit: string;
  rate: number | string;
};

export function UnitServiceEntryForm({
  projectId,
  services,
  workDate,
}: {
  projectId: string;
  services: UnitServiceOption[];
  workDate: string;
}) {
  return (
    <form action={addUnitServiceEntryAction} className="form-grid">
      <input type="hidden" name="project_id" value={projectId} />
      <label>
        Approved Per-Unit Service
        <select name="source_fee_item_id" required defaultValue="">
          <option value="" disabled>Select service</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.description} — {money(service.rate)} per {service.unit}
            </option>
          ))}
        </select>
        <span>Quantity, unit, and rate originate from the accepted proposal.</span>
      </label>
      <label>
        Date
        <input name="work_date" type="date" defaultValue={workDate} required />
      </label>
      <label>
        Completed Quantity
        <input name="quantity" type="number" min="0.001" step="0.001" required />
        <span>Enter the actual completed quantity, such as 3 floorplans or 120 points.</span>
      </label>
      <label className="check">
        <input name="billable" type="checkbox" defaultChecked />
        Billable
      </label>
      <label className="full">
        Notes
        <textarea name="description" rows={2} placeholder="Optional project detail" />
      </label>
      <div className="full">
        <button className="primary-button" type="submit">Save Per-Unit Work</button>
      </div>
    </form>
  );
}
