"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordManualProposalAuthorizationAction } from "@/app/actions/proposals";

type AuthorizationMethod = "verbal" | "email";

function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ManualProposalAuthorizationForm({
  proposalId,
  revisionId,
  defaultSigner,
}: {
  proposalId: string;
  revisionId: string;
  defaultSigner: {
    name: string;
    title: string;
    email: string;
    mobile: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState<AuthorizationMethod>("verbal");
  const [authorizedAt, setAuthorizedAt] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setAuthorizedAt(localDateTimeValue(new Date()));
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const localValue = String(formData.get("authorized_at_local") ?? "");
    const parsedDate = new Date(localValue);

    if (!localValue || Number.isNaN(parsedDate.getTime())) {
      setError("Enter the date and time the customer authorized the proposal.");
      return;
    }

    const confirmed = window.confirm(
      "Record this customer authorization? The proposal will be marked accepted, all customer links will be revoked, and the project will be created. This creates a permanent audit record.",
    );
    if (!confirmed) return;

    formData.set("authorized_at", parsedDate.toISOString());
    formData.delete("authorized_at_local");

    startTransition(async () => {
      setError("");
      const result = await recordManualProposalAuthorizationAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form className="form-grid manual-authorization-form" onSubmit={submit}>
      <input name="proposal_id" type="hidden" value={proposalId} />
      <input name="revision_id" type="hidden" value={revisionId} />
      <label>
        Authorization Method
        <select
          name="authorization_method"
          value={method}
          disabled={pending}
          onChange={(event) => setMethod(event.target.value as AuthorizationMethod)}
        >
          <option value="verbal">Verbal</option>
          <option value="email">Email</option>
        </select>
        <span>This remains visibly distinct from customer-completed electronic approval.</span>
      </label>
      <label>
        Authorization Date and Time
        <input
          name="authorized_at_local"
          type="datetime-local"
          value={authorizedAt}
          disabled={pending}
          required
          onChange={(event) => setAuthorizedAt(event.target.value)}
        />
        <span>Enter when the customer actually gave authorization.</span>
      </label>
      <label>
        Customer Name
        <input name="signer_name" defaultValue={defaultSigner.name} disabled={pending} required />
      </label>
      <label>
        Customer Title
        <input name="signer_title" defaultValue={defaultSigner.title} disabled={pending} />
      </label>
      <label>
        Customer Email
        <input name="signer_email" type="email" defaultValue={defaultSigner.email} disabled={pending} />
      </label>
      <label>
        Customer Mobile
        <input name="signer_mobile" type="tel" defaultValue={defaultSigner.mobile} disabled={pending} />
      </label>
      <label className="full">
        Authorization Notes
        <textarea
          name="recording_notes"
          rows={4}
          maxLength={4000}
          disabled={pending}
          required
          placeholder={method === "email"
            ? "Describe the customer email and what was authorized."
            : "Describe when and how the customer gave verbal authorization."}
        />
      </label>
      <label className="full">
        Supporting Evidence {method === "email" ? "(required)" : "(optional)"}
        <input
          name="evidence_file"
          type="file"
          accept=".pdf,.eml,.msg,.png,.jpg,.jpeg,application/pdf,message/rfc822,image/png,image/jpeg"
          disabled={pending}
          required={method === "email"}
        />
        <span>Attach the saved email, a PDF, or a screenshot. Maximum file size: 10 MB.</span>
      </label>
      <label className="check full manual-authorization-attestation">
        <input name="authorization_attestation" type="checkbox" disabled={pending} required />
        I confirm that the customer authorized this exact locked proposal version and that the information above is accurate.
      </label>
      <div className="full">
        <button className="primary-button" type="submit" disabled={pending || !authorizedAt}>
          {pending ? "Recording Authorization…" : "Record Manual Authorization"}
        </button>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </div>
    </form>
  );
}
