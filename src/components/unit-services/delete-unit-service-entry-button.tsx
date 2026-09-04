"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteUnitServiceEntryAction } from "@/app/actions/unit-services";

export function DeleteUnitServiceEntryButton({
  entryId,
  quantity,
  unit,
}: {
  entryId: string;
  quantity: number;
  unit: string;
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
          if (!window.confirm(`Delete this ${quantity} ${unit} entry? This cannot be undone.`)) return;
          startTransition(async () => {
            try {
              setError("");
              await deleteUnitServiceEntryAction(entryId);
              router.refresh();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Unable to delete the entry.");
            }
          });
        }}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}
