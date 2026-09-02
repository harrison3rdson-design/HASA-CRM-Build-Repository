"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTimeEntryAction } from "@/app/actions/time";

export function DeleteTimeEntryButton({
  timeEntryId,
  workDate,
  entryHours,
}: {
  timeEntryId: string;
  workDate: string;
  entryHours: number;
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
        aria-label={`Delete ${entryHours} hour time entry from ${workDate}`}
        onClick={() => {
          const confirmed = window.confirm(
            `Delete the ${entryHours.toFixed(2)} hour time entry from ${workDate}? This cannot be undone.`,
          );
          if (!confirmed) return;

          startTransition(async () => {
            try {
              setError("");
              await deleteTimeEntryAction(timeEntryId);
              router.refresh();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Unable to delete the time entry.");
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
