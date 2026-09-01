export function AcceptancePreviewCard() {
  return (
    <section className="public-acceptance-card public-acceptance-preview" aria-labelledby="preview-acceptance-title">
      <div className="public-acceptance-heading">
        <h2 id="preview-acceptance-title">Acceptance</h2>
        <span className="public-preview-pill">Preview only</span>
      </div>
      <p>This is how the customer acceptance area will appear after the proposal is sent.</p>
      <fieldset disabled aria-describedby="preview-acceptance-note">
        <label>Name<input name="previewSignerName" /></label>
        <label>Title<input name="previewSignerTitle" /></label>
        <label>Email<input name="previewSignerEmail" type="email" /></label>
        <label>Mobile Phone<input name="previewSignerMobile" /></label>
        <label className="accept-check">
          <input type="checkbox" />
          I have reviewed this document and authorize HASA Concepts, LLC to proceed.
        </label>
        <button className="public-primary" disabled type="button">Accept Proposal</button>
      </fieldset>
      <p id="preview-acceptance-note" className="public-preview-note">
        Acceptance is disabled in preview. No email, text message, customer link, view record, or lock is created.
      </p>
    </section>
  );
}
