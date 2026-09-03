import { uploadDocumentAction } from "@/app/actions/documents";

export function DocumentUploadForm({
  clientId, projectId
}: { clientId: string; projectId: string }) {
  return (
    <form action={uploadDocumentAction} className="form-grid">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="project_id" value={projectId} />
      <label>Title<input name="title" required /></label>
      <label>Document Type
        <select name="document_type" defaultValue="other">
          <option value="proposal">Proposal</option>
          <option value="invoice">Invoice</option>
          <option value="additional_service">Additional Service</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>Subtype<input name="document_subtype" /></label>
      <label>Date<input name="document_date" type="date" /></label>
      <label className="full">File<input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required /></label>
      <div className="full"><button className="primary-button" type="submit">Upload Document</button></div>
    </form>
  );
}
