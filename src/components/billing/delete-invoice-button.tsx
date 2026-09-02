"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteUnissuedDraftInvoiceAction } from "@/app/actions/invoices";

export function DeleteInvoiceButton({
  invoiceId,
  invoiceNumber,
  projectId,
}: {
  invoiceId: string;
  invoiceNumber: string;
  projectId: string;
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
            `Delete draft Invoice ${invoiceNumber}? Linked draft time and expenses will return to the project, and this latest invoice number will be released for reuse. This cannot be undone.`,
          );
          if (!confirmed) return;

          startTransition(async () => {
            try {
              setError("");
              await deleteUnissuedDraftInvoiceAction(invoiceId);
              router.replace(`/projects/${projectId}`);
              router.refresh();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Unable to delete the invoice.");
            }
          });
        }}
      >
        {pending ? "Deleting…" : "Delete Draft Invoice"}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}
