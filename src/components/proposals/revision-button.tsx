"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProposalRevisionAction } from "@/app/actions/proposals";

export function CreateRevisionButton({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div>
      <button
        className="secondary-button"
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          try {
            setError("");
            await createProposalRevisionAction(proposalId);
            router.push(`/proposals/${proposalId}?edit=1`);
          } catch (e: any) {
            setError(e?.message ?? "Unable to create revision.");
          }
        })}
      >
        {pending ? "Creating…" : "Create Revision"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
