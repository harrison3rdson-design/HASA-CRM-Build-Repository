"use client";

import { useActionState } from "react";
import { completeInvitationAction } from "@/app/actions/user-administration";

export function CompleteInvitationForm() {
  const [state, action, pending] = useActionState(completeInvitationAction, { status: "idle" as const, message: "" });
  return (
    <form action={action} className="login-form">
      <label>New Password<input name="password" type="password" autoComplete="new-password" minLength={12} required /></label>
      <label>Confirm Password<input name="password_confirmation" type="password" autoComplete="new-password" minLength={12} required /></label>
      <p className="footnote">Use at least 12 characters with uppercase, lowercase, and a number.</p>
      {state.message ? <p className={`form-message ${state.status}`} role="alert">{state.message}</p> : null}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving…" : "Set Password and Continue"}</button>
    </form>
  );
}
