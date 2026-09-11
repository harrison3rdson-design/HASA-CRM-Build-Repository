"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import {
  calculateAlternateSelection,
  type ProposalAlternate,
} from "@/lib/proposal-alternates";
import { money } from "@/lib/ui/format";

export type AcceptanceReceipt = {
  acceptedAt: string;
  signerName: string;
  reference: string;
  acceptanceVersionId?: string;
  acceptedTotal?: number;
  emailedTo?: string[];
  deliveryWarning?: string | null;
};

type Props = {
  actionUrl: string;
  buttonText: string;
  initialReceipt?: AcceptanceReceipt | null;
  alternates?: ProposalAlternate[];
  baseTotal?: number | string;
  requireEmail?: boolean;
};

function formatAcceptedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function alternateRuleLabel(alternate: ProposalAlternate, alternates: ProposalAlternate[]) {
  if (alternate.alternate_type === "independent") return "May be selected independently";
  if (alternate.alternate_type === "dependent") {
    const required = alternates.find(
      (candidate) => candidate.alternate_key === alternate.required_alternate_key,
    );
    return `Requires ${required?.title ?? "another alternate"}`;
  }
  const componentTitles = alternates
    .filter((candidate) => (alternate.bundle_component_keys ?? []).includes(candidate.alternate_key))
    .map((candidate) => candidate.title);
  return `Bundle replaces ${componentTitles.join(", ")}`;
}

export function AcceptanceCard({
  actionUrl,
  buttonText,
  initialReceipt = null,
  alternates = [],
  baseTotal = 0,
  requireEmail = false,
}: Props) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<AcceptanceReceipt | null>(initialReceipt);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const selection = useMemo(
    () => calculateAlternateSelection(alternates, selectedKeys, baseTotal),
    [alternates, baseTotal, selectedKeys],
  );

  function updateSelection(alternate: ProposalAlternate, checked: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (checked) {
        if (alternate.alternate_type === "bundle") {
          for (const componentKey of alternate.bundle_component_keys ?? []) next.delete(componentKey);
        } else {
          for (const bundle of alternates) {
            if (
              bundle.alternate_type === "bundle"
              && (bundle.bundle_component_keys ?? []).includes(alternate.alternate_key)
            ) next.delete(bundle.alternate_key);
          }
        }
        next.add(alternate.alternate_key);
      } else {
        next.delete(alternate.alternate_key);
      }

      let changed = true;
      while (changed) {
        changed = false;
        for (const candidate of alternates) {
          if (
            candidate.alternate_type === "dependent"
            && next.has(candidate.alternate_key)
            && !next.has(candidate.required_alternate_key ?? "")
          ) {
            next.delete(candidate.alternate_key);
            changed = true;
          }
        }
      }
      return alternates
        .map((candidate) => candidate.alternate_key)
        .filter((key) => next.has(key));
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || receipt) return;

    const formData = new FormData(event.currentTarget);
    setPending(true);
    setError("");

    const body = {
      signerName: String(formData.get("signerName") ?? ""),
      signerTitle: String(formData.get("signerTitle") ?? ""),
      signerEmail: String(formData.get("signerEmail") ?? ""),
      signerMobile: String(formData.get("signerMobile") ?? ""),
      selectedAlternateKeys: selection.selectedKeys,
      signatureType: "typed",
      acceptanceStatement: "I accept and authorize this document.",
    };

    try {
      const res = await fetch(actionUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Acceptance could not be recorded.");
      }

      const data = await res.json() as AcceptanceReceipt;
      setReceipt(data);
      requestAnimationFrame(() => successHeadingRef.current?.focus());
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "Unable to accept. Your information has been retained so you can try again.");
    } finally {
      setPending(false);
    }
  }

  if (receipt) {
    return (
      <section className="public-acceptance-card public-acceptance-success" aria-labelledby="acceptance-complete-title" role="status" aria-live="polite">
        <div className="public-success-icon" aria-hidden="true">&#10003;</div>
        <div>
          <p className="public-success-eyebrow">Transaction complete</p>
          <h2 id="acceptance-complete-title" ref={successHeadingRef} tabIndex={-1}>
            Your approval was successful
          </h2>
        </div>
        <p className="public-success-message">
          Thank you. Your exact proposal choices and electronic approval have been recorded in a locked contract package.
        </p>
        <dl className="public-receipt-details">
          <div><dt>Document</dt><dd>{receipt.reference}</dd></div>
          <div><dt>Approved by</dt><dd>{receipt.signerName}</dd></div>
          <div><dt>Approval date</dt><dd><time dateTime={receipt.acceptedAt}>{formatAcceptedAt(receipt.acceptedAt)}</time></dd></div>
          <div><dt>Status</dt><dd><strong>Accepted</strong></dd></div>
          {receipt.acceptanceVersionId ? <div><dt>Acceptance ID</dt><dd>{receipt.acceptanceVersionId}</dd></div> : null}
          {receipt.acceptedTotal !== undefined ? <div><dt>Accepted total</dt><dd><strong>{money(receipt.acceptedTotal)}</strong></dd></div> : null}
        </dl>
        {receipt.deliveryWarning ? (
          <p className="public-delivery-warning">{receipt.deliveryWarning}</p>
        ) : (
          <p className="public-success-note">
            No further action is required. {" "}
            The completed PDF was emailed to you and HASA Concepts and retained with the proposal record.
          </p>
        )}
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="public-acceptance-card">
      <div className="public-acceptance-heading">
        <div>
          <p className="public-success-eyebrow">Final authorization</p>
          <h2>Choose Options and Accept</h2>
        </div>
        <strong className="public-live-total">{money(selection.acceptedTotal)}</strong>
      </div>
      <p>Review the required base scope, select any alternates, and confirm the final contract total before signing.</p>
      {error ? <div className="public-error" role="alert"><strong>Approval not completed.</strong><span>{error}</span></div> : null}

      <fieldset className="public-alternate-fieldset" disabled={pending}>
        <legend>Contract Choices</legend>
        <label className="public-choice-card public-choice-required">
          <input type="checkbox" checked disabled readOnly />
          <span>
            <strong>Base Proposal Scope</strong>
            <small>Required and cannot be removed</small>
          </span>
          <strong>{money(baseTotal)}</strong>
        </label>
        {alternates.map((alternate) => {
          const checked = selectedKeys.includes(alternate.alternate_key);
          const dependencyUnavailable = alternate.alternate_type === "dependent"
            && !selectedKeys.includes(alternate.required_alternate_key ?? "");
          return (
            <label className="public-choice-card" key={alternate.alternate_key}>
              <input
                type="checkbox"
                checked={checked}
                disabled={pending || dependencyUnavailable}
                onChange={(event) => updateSelection(alternate, event.target.checked)}
              />
              <span>
                <strong>{alternate.title}</strong>
                {alternate.description ? <small>{alternate.description}</small> : null}
                <small className="public-choice-rule">{alternateRuleLabel(alternate, alternates)}</small>
              </span>
              <strong>+{money(alternate.amount)}</strong>
            </label>
          );
        })}
      </fieldset>

      <section className="public-final-choices" aria-live="polite">
        <h3>Your Final Choices</h3>
        <div className="public-choice-summary-grid">
          <div>
            <strong>Selected</strong>
            <ul>
              <li>Base Proposal Scope <span>{money(baseTotal)}</span></li>
              {selection.selected.map((alternate) => (
                <li key={alternate.alternate_key}>{alternate.title} <span>+{money(alternate.amount)}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Declined</strong>
            {selection.declined.length ? (
              <ul>{selection.declined.map((alternate) => (
                <li key={alternate.alternate_key}>{alternate.title}</li>
              ))}</ul>
            ) : <p>None</p>}
          </div>
        </div>
        <dl className="public-contract-total">
          <div><dt>Base contract</dt><dd>{money(baseTotal)}</dd></div>
          <div><dt>Selected alternates</dt><dd>{money(selection.alternateTotal)}</dd></div>
          <div><dt>Total accepted contract</dt><dd>{money(selection.acceptedTotal)}</dd></div>
        </dl>
      </section>

      <fieldset disabled={pending}>
        <legend>Electronic Signature</legend>
        <label>Name<input name="signerName" required /></label>
        <label>Title<input name="signerTitle" /></label>
        <label>Email<input name="signerEmail" type="email" required={requireEmail} /></label>
        <label>Mobile Phone<input name="signerMobile" /></label>
        <label className="accept-check">
          <input type="checkbox" required />
          I have reviewed the proposal, the selected and declined alternates, the terms, and the total accepted contract shown above. I authorize HASA Concepts, LLC to proceed.
        </label>
      </fieldset>
      <button className="public-primary" disabled={pending} type="submit">
        {pending ? "Creating Final Contract…" : buttonText}
      </button>
      {pending ? <p className="public-processing" role="status">Locking your choices and creating the final PDF. Please do not close this page.</p> : null}
    </form>
  );
}
