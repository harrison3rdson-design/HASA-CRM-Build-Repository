"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLatestProposalRevisionAction } from "@/app/actions/proposals";

export function DeleteRevisionButton({
  proposalId,
  revisionNumber,
}: {
  proposalId: string;
  revisionNumber: number;
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
            `Delete unlocked Revision ${revisionNumber}? Its scope, labor, expenses, and draft link will be removed. This cannot be undone.`
          );
          if (!confirmed) return;

          startTransition(async () => {
            try {
              setError("");
              await deleteLatestProposalRevisionAction(proposalId);
              router.replace(`/proposals/${proposalId}`);
              router.refresh();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Unable to delete the revision.");
            }
          });
        }}
      >
        {pending ? "Deleting…" : `Delete Revision ${revisionNumber}`}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}
