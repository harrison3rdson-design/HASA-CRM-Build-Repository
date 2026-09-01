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
  emailConfigured,
  smsConfigured,
}: {
  proposalId: string;
  revisionId: string;
  hasEmail: boolean;
  hasMobile: boolean;
  emailConfigured: boolean;
  smsConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const canEmail = hasEmail && emailConfigured;
  const canSms = hasMobile && smsConfigured;
  const defaultMethod: DeliveryMethod = canEmail && canSms ? "both" : canEmail ? "email" : "sms";
  const [method, setMethod] = useState<DeliveryMethod>(defaultMethod);
  const canSend = canEmail || canSms;

  return (
    <div>
      <div className="button-row">
        <select
          aria-label="Proposal delivery method"
          value={method}
          disabled={pending || !canSend}
          onChange={(event) => setMethod(event.target.value as DeliveryMethod)}
        >
          {canEmail ? <option value="email">Email</option> : null}
          {canSms ? <option value="sms">Text message</option> : null}
          {canEmail && canSms ? <option value="both">Email and text</option> : null}
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
                const result = await sendProposalAction({ proposalId, revisionId, method });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
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
      {!hasEmail && !hasMobile ? <p className="form-error">Add an email address or mobile number to the primary contact before sending.</p> : null}
      {hasMobile && !smsConfigured ? <p className="form-error">Text messaging is not configured for this app. Add the HASA Twilio account settings before sending.</p> : null}
      {hasEmail && !emailConfigured ? <p className="form-error">Email delivery is not configured for this app.</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}
