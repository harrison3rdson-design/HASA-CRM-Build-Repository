"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateAndSendInvoiceAction } from "@/app/actions/invoice-delivery";

type DeliveryMethod = "sms" | "email" | "both";

export function SendAndLockInvoiceForm({
  invoiceId,
  hasEmail,
  hasMobile,
  emailConfigured,
  smsConfigured,
}: {
  invoiceId: string;
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
      <p className="footnote">
        Preview the customer PDF first. A successful delivery locks the invoice and starts its payment-terms due-date period.
        If delivery fails, a draft remains editable.
      </p>
      <div className="button-row">
        <select
          aria-label="Invoice delivery method"
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
              "Send this invoice to the customer? A successful delivery will lock the invoice and start its payment-terms due date."
            );
            if (!confirmed) return;

            startTransition(async () => {
              try {
                setError("");
                const result = await generateAndSendInvoiceAction({ invoiceId, method });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Unable to send the invoice.");
              }
            });
          }}
        >
          {pending ? "Sending…" : "Send and Lock Invoice"}
        </button>
      </div>
      {!hasEmail && !hasMobile ? (
        <p className="form-error">Add an email address or mobile number to the project contact before sending.</p>
      ) : null}
      {hasMobile && !smsConfigured ? <p className="form-error">Text messaging is not configured for this app.</p> : null}
      {hasEmail && !emailConfigured ? <p className="form-error">Email delivery is not configured for this app.</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}
