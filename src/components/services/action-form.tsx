"use client";
import { useState, useTransition, type ReactNode, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ServiceActionResult } from "@/app/actions/services";
export function ActionForm({
  action,
  children,
  button = "Save",
  className = "form-grid",
}: {
  action: (f: FormData) => Promise<ServiceActionResult>;
  children: ReactNode;
  button?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setMessage("");
    start(async () => {
      try {
        const result = await action(data);
        setFailed(Boolean(result.error));
        setMessage(result.error ?? "Saved.");
        if (result.href) router.push(result.href);
        else router.refresh();
      } catch {
        setFailed(true);
        setMessage("The change could not be saved. Please try again.");
      }
    });
  }
  return (
    <form onSubmit={submit} className={className}>
      <fieldset disabled={pending} style={{ display: "contents" }}>
        {children}
        <div className="full">
          <button className="primary-button" disabled={pending}>
            {pending ? "Saving…" : button}
          </button>
        </div>
      </fieldset>
      {message && (
        <p
          className={failed ? "full form-error" : "full"}
          role={failed ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </form>
  );
}
