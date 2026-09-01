"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteUnissuedDraftProposalAction } from "@/app/actions/proposals";

export function DeleteProposalButton({
  proposalId,
  proposalNumber,
  clientId,
}: {
  proposalId: string;
  proposalNumber: string;
  clientId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div>
      <button
        className="secondary-button danger-button"
        type="button"
        disabled={pending}
        onClick={() => {
          const confirmed = window.confirm(
            `Delete draft Proposal ${proposalNumber}? This is allowed only if it was never issued or viewed by a customer. All draft content will be permanently removed, and the latest proposal number will be released for reuse. This cannot be undone.`
          );
          if (!confirmed) return;

          startTransition(async () => {
            try {
              setError("");
              await deleteUnissuedDraftProposalAction(proposalId);
              router.replace(`/clients/${clientId}`);
              router.refresh();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Unable to delete the proposal.");
            }
          });
        }}
      >
        {pending ? "Deleting…" : "Delete Draft Proposal"}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}
