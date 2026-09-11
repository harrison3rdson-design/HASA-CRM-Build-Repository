import type { ProposalAlternate } from "@/lib/proposal-alternates";
import { money } from "@/lib/ui/format";

export function AcceptancePreviewCard({
  buttonText = "Accept Proposal",
  alternates = [],
  baseTotal = 0,
}: {
  buttonText?: string;
  alternates?: ProposalAlternate[];
  baseTotal?: number | string;
}) {
  return (
    <section className="public-acceptance-card public-acceptance-preview" aria-labelledby="preview-acceptance-title">
      <div className="public-acceptance-heading">
        <div>
          <p className="public-success-eyebrow">Final authorization</p>
          <h2 id="preview-acceptance-title">Choose Options and Accept</h2>
        </div>
        <span className="public-preview-pill">Preview only</span>
      </div>
      <p>This is how the customer acceptance area will appear after the proposal is sent.</p>
      <fieldset className="public-alternate-fieldset" disabled>
        <legend>Contract Choices</legend>
        <label className="public-choice-card public-choice-required">
          <input type="checkbox" checked readOnly />
          <span><strong>Base Proposal Scope</strong><small>Required and cannot be removed</small></span>
          <strong>{money(baseTotal)}</strong>
        </label>
        {alternates.map((alternate) => (
          <label className="public-choice-card" key={alternate.alternate_key}>
            <input type="checkbox" />
            <span>
              <strong>{alternate.title}</strong>
              {alternate.description ? <small>{alternate.description}</small> : null}
            </span>
            <strong>+{money(alternate.amount)}</strong>
          </label>
        ))}
      </fieldset>
      <section className="public-final-choices">
        <h3>Your Final Choices</h3>
        <div className="public-choice-summary-grid">
          <div><strong>Selected</strong><ul><li>Base Proposal Scope <span>{money(baseTotal)}</span></li></ul></div>
          <div><strong>Declined</strong>{alternates.length ? <ul>{alternates.map((alternate) => <li key={alternate.alternate_key}>{alternate.title}</li>)}</ul> : <p>None</p>}</div>
        </div>
        <dl className="public-contract-total">
          <div><dt>Base contract</dt><dd>{money(baseTotal)}</dd></div>
          <div><dt>Selected alternates</dt><dd>{money(0)}</dd></div>
          <div><dt>Total accepted contract</dt><dd>{money(baseTotal)}</dd></div>
        </dl>
      </section>
      <fieldset disabled aria-describedby="preview-acceptance-note">
        <legend>Electronic Signature</legend>
        <label>Name<input name="previewSignerName" /></label>
        <label>Title<input name="previewSignerTitle" /></label>
        <label>Email<input name="previewSignerEmail" type="email" /></label>
        <label>Mobile Phone<input name="previewSignerMobile" /></label>
        <label className="accept-check">
          <input type="checkbox" />
          I have reviewed the proposal, the selected and declined alternates, the terms, and the total accepted contract shown above. I authorize HASA Concepts, LLC to proceed.
        </label>
        <button className="public-primary" disabled type="button">{buttonText}</button>
      </fieldset>
      <p id="preview-acceptance-note" className="public-preview-note">
        Acceptance is disabled in preview. No email, text message, customer link, view record, or lock is created.
      </p>
    </section>
  );
}
