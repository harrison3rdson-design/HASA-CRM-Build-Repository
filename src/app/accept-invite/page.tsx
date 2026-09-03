import { redirect } from "next/navigation";
import { CompleteInvitationForm } from "@/components/forms/complete-invitation-form";
import { getCurrentAppUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage() {
  const { authUser, appUser } = await getCurrentAppUser();
  if (!authUser) redirect(`/login?error=${encodeURIComponent("This account link is invalid or expired.")}`);
  return <main className="login-shell"><section className="login-card">
    <div className="brand login-brand"><div className="brand-mark">HASA</div><div className="brand-sub">CONCEPTS</div></div>
    <h1>Set Up Your Account</h1>
    {appUser?.active ? <><p>Choose a password to finish activating your HASA Concepts Management access.</p><CompleteInvitationForm /></> : <p className="form-message error" role="alert">This account does not have active application access. Contact an Owner Administrator.</p>}
  </section></main>;
}
