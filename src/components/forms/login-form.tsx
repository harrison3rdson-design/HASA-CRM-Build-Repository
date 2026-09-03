"use client";

import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { signInAction } from "@/app/actions/auth";

export function LoginForm({ error, siteKey }: { error?: string; siteKey?: string }) {
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaConfigured = Boolean(siteKey);

  return (
    <form action={signInAction} className="login-form">
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {siteKey ? (
        <div className="captcha-widget">
          <Turnstile
            siteKey={siteKey}
            onSuccess={setCaptchaToken}
            onExpire={() => setCaptchaToken("")}
            onError={() => setCaptchaToken("")}
            options={{ theme: "auto" }}
          />
        </div>
      ) : (
        <p className="form-message error" role="alert">
          Sign-in protection is being configured. Please try again shortly.
        </p>
      )}
      <input name="captchaToken" type="hidden" value={captchaToken} />
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      <button className="primary-button" type="submit" disabled={!captchaConfigured || !captchaToken}>
        Sign In
      </button>
    </form>
  );
}
