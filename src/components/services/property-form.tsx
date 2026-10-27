import { ActionForm } from "./action-form";
import { savePropertyAction, saveModelAction } from "@/app/actions/services";
import { todayInNewYork } from "@/lib/services/terms";
export function PropertyForm({
  clients,
  property,
  clientId,
}: {
  clients: { id: string; company_name: string }[];
  property?: any;
  clientId?: string;
}) {
  return (
    <ActionForm
      action={savePropertyAction}
      button={property ? "Save Property" : "Create Property"}
    >
      {property && (
        <input type="hidden" name="property_id" value={property.id} />
      )}
      {property ? (
        <input type="hidden" name="client_id" value={property.client_id} />
      ) : (
        <label>
          Client
          <select name="client_id" required defaultValue={clientId ?? ""}>
            <option value="" disabled>
              Select client
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Property name
        <input
          name="name"
          required
          maxLength={200}
          defaultValue={property?.name}
        />
      </label>
      <label>
        Property type
        <select
          name="property_type"
          defaultValue={property?.property_type ?? "vacation_rental"}
        >
          <option value="vacation_rental">Vacation rental</option>
          <option value="commercial">Commercial facility</option>
          <option value="resort">Resort</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        Address
        <textarea name="address" required defaultValue={property?.address} />
      </label>
      <label>
        Approximate square feet
        <input
          name="square_feet"
          type="number"
          min="0"
          step="0.01"
          defaultValue={property?.square_feet ?? ""}
        />
      </label>
      <label>
        Access instructions / site contact
        <textarea name="access_notes" defaultValue={property?.access_notes} />
      </label>
      <label className="check">
        <input
          name="active"
          type="checkbox"
          defaultChecked={property?.active ?? true}
        />
        Active property
      </label>
    </ActionForm>
  );
}
export function ModelForm({
  propertyId,
  model,
}: {
  propertyId: string;
  model?: any;
}) {
  return (
    <ActionForm
      action={saveModelAction}
      button={model ? "Save Model" : "Add Model"}
    >
      <input type="hidden" name="property_id" value={propertyId} />
      {model && <input type="hidden" name="model_id" value={model.id} />}
      <label>
        Model / building / version name
        <input name="name" required defaultValue={model?.name} />
      </label>
      <label>
        HTTPS model link
        <input
          name="model_url"
          type="url"
          required
          defaultValue={model?.model_url}
          placeholder="https://my.matterport.com/show/?m=…"
        />
      </label>
      <label>
        Capture date
        <input
          name="captured_on"
          type="date"
          required
          max={todayInNewYork()}
          defaultValue={model?.captured_on ?? todayInNewYork()}
        />
      </label>
      <label>
        Intended audience
        <select
          name="visibility"
          defaultValue={model?.visibility ?? "internal"}
        >
          <option value="internal">Internal facility record</option>
          <option value="guest_facing">Guest-facing tour</option>
        </select>
        <span>
          This label does not change Matterport permissions. Set access on the
          model platform.
        </span>
      </label>
      <label>
        Platform capacity consumed
        <input
          name="capacity_units"
          type="number"
          min="1"
          max="10000"
          required
          defaultValue={model?.capacity_units ?? 1}
        />
      </label>
      <label className="check">
        <input
          name="hosted"
          type="checkbox"
          defaultChecked={model?.hosted ?? true}
        />
        Currently hosted (counts toward capacity)
      </label>
      <label className="full">
        Notes
        <textarea name="notes" defaultValue={model?.notes} />
      </label>
    </ActionForm>
  );
}
