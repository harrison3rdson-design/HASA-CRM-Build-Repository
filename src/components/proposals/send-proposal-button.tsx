"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendProposalAction } from "@/app/actions/send-documents";

type DeliveryMethod = "sms" | "email" | "both";

export function SendProposalButton({
  proposalId,
  revisionId,
  hasEmail,
  hasMobile,
}: {
  proposalId: string;
  revisionId: string;
  hasEmail: boolean;
  hasMobile: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const defaultMethod: DeliveryMethod = hasEmail && hasMobile ? "both" : hasEmail ? "email" : "sms";
  const [method, setMethod] = useState<DeliveryMethod>(defaultMethod);
  const canSend = hasEmail || hasMobile;

  return (
    <div>
      <div className="button-row">
        <select
          aria-label="Proposal delivery method"
          value={method}
          disabled={pending || !canSend}
          onChange={(event) => setMethod(event.target.value as DeliveryMethod)}
        >
          {hasEmail ? <option value="email">Email</option> : null}
          {hasMobile ? <option value="sms">Text message</option> : null}
          {hasEmail && hasMobile ? <option value="both">Email and text</option> : null}
        </select>
        <button
          className="primary-button"
          type="button"
          disabled={pending || !canSend}
          onClick={() => {
            const confirmed = window.confirm(
              "Send this proposal to the customer? This revision will be locked and can no longer be edited."
            );
            if (!confirmed) return;

            startTransition(async () => {
              try {
                setError("");
                await sendProposalAction({ proposalId, revisionId, method });
                router.replace(`/proposals/${proposalId}`);
                router.refresh();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Unable to send the proposal.");
              }
            });
          }}
        >
          {pending ? "Sending…" : "Send & Lock"}
        </button>
      </div>
      {!canSend ? <p className="form-error">Add an email address or mobile number to the primary contact before sending.</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}
