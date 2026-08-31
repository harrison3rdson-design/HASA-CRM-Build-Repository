import { signInAction } from "@/app/actions/auth";

export function LoginForm({ error }: { error?: string }) {
  return (
    <form action={signInAction} className="login-form">
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      <button className="primary-button" type="submit">Sign In</button>
    </form>
  );
}
