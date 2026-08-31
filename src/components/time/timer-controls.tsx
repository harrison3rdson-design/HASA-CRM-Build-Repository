"use client";

import { useState, useTransition } from "react";
import { stopTimerAction } from "@/app/actions/time";

export function TimerStopButton({ timeEntryId }: { timeEntryId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div>
      <button
        className="primary-button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          try {
            setError("");
            await stopTimerAction(timeEntryId);
          } catch (e: any) {
            setError(e?.message ?? "Unable to stop timer.");
          }
        })}
      >
        {pending ? "Stopping…" : "Stop & Save"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
