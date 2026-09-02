"use client";

import { type FormEvent, useRef, useState } from "react";

export type AcceptanceReceipt = {
  acceptedAt: string;
  signerName: string;
  reference: string;
};

type Props = {
  actionUrl: string;
  buttonText: string;
  initialReceipt?: AcceptanceReceipt | null;
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

export function AcceptanceCard({ actionUrl, buttonText, initialReceipt = null }: Props) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<AcceptanceReceipt | null>(initialReceipt);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

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
          Thank you. Your electronic approval has been recorded. No further action is required.
        </p>
        <dl className="public-receipt-details">
          <div><dt>Document</dt><dd>{receipt.reference}</dd></div>
          <div><dt>Approved by</dt><dd>{receipt.signerName}</dd></div>
          <div><dt>Approval date</dt><dd><time dateTime={receipt.acceptedAt}>{formatAcceptedAt(receipt.acceptedAt)}</time></dd></div>
          <div><dt>Status</dt><dd><strong>Accepted</strong></dd></div>
        </dl>
        <p className="public-success-note">A completed copy is retained with the project records.</p>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="public-acceptance-card">
      <h2>Acceptance</h2>
      <p>Enter your information below to accept this document electronically.</p>
      {error ? <div className="public-error" role="alert"><strong>Approval not completed.</strong><span>{error}</span></div> : null}
      <fieldset disabled={pending}>
        <label>Name<input name="signerName" required /></label>
        <label>Title<input name="signerTitle" /></label>
        <label>Email<input name="signerEmail" type="email" /></label>
        <label>Mobile Phone<input name="signerMobile" /></label>
        <label className="accept-check">
          <input type="checkbox" required />
          I have reviewed this document and authorize HASA Concepts, LLC to proceed.
        </label>
      </fieldset>
      <button className="public-primary" disabled={pending} type="submit">
        {pending ? "Processing…" : buttonText}
      </button>
      {pending ? <p className="public-processing" role="status">Recording your approval. Please do not close this page.</p> : null}
    </form>
  );
}
