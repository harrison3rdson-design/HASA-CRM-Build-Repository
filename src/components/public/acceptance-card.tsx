"use client";

import { useState } from "react";

type Props = {
  actionUrl: string;
  buttonText: string;
};

export function AcceptanceCard({ actionUrl, buttonText }: Props) {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setStatus("");

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

      setStatus("Accepted successfully. A completed copy will be retained with the project records.");
    } catch (e: any) {
      setStatus(e?.message ?? "Unable to accept.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className="public-acceptance-card">
      <h2>Acceptance</h2>
      <p>Enter your information below to accept this document electronically.</p>
      <label>Name<input name="signerName" required /></label>
      <label>Title<input name="signerTitle" /></label>
      <label>Email<input name="signerEmail" type="email" /></label>
      <label>Mobile Phone<input name="signerMobile" /></label>
      <label className="accept-check">
        <input type="checkbox" required />
        I have reviewed this document and authorize HASA Concepts, LLC to proceed.
      </label>
      <button className="public-primary" disabled={pending} type="submit">
        {pending ? "Processing…" : buttonText}
      </button>
      {status ? <p className="public-status">{status}</p> : null}
    </form>
  );
}
