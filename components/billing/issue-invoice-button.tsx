"use client";

import { useState, useTransition } from "react";
import { issueInvoiceAction } from "@/app/actions/invoices";

export function IssueInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div>
      <button
        className="primary-button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          try {
            setError("");
            await issueInvoiceAction(invoiceId);
          } catch (e: any) {
            setError(e?.message ?? "Unable to issue invoice.");
          }
        })}
      >
        {pending ? "Issuing…" : "Issue Invoice"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
