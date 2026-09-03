import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import { MfaForm } from "@/components/forms/mfa-form";
import { getMfaStatus, isMfaVerified } from "@/lib/auth/mfa";
import { getCurrentAppUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function MfaPage() {
  const { supabase, authUser, appUser } = await getCurrentAppUser();

  if (!authUser || !appUser?.active) redirect("/login");

  const status = await getMfaStatus(supabase);
  if (isMfaVerified(status)) redirect("/dashboard");

  const mode = status.verifiedFactorId ? "challenge" : "enroll";

  return (
    <main className="login-shell">
      <section className="login-card mfa-card">
        <div className="brand login-brand">
          <div className="brand-mark">HASA</div>
          <div className="brand-sub">CONCEPTS</div>
        </div>
        <h1>
          {mode === "enroll"
            ? "Protect Your Account"
            : "Verify Your Identity"}
        </h1>
        <p>
          {mode === "enroll"
            ? "Set up multi-factor authentication before continuing to the management system."
            : "Multi-factor authentication is required to access the management system."}
        </p>
        <MfaForm
          mode={mode}
          verifiedFactorId={status.verifiedFactorId ?? undefined}
        />
        <form action={signOutAction} className="mfa-signout">
          <button className="secondary-button" type="submit">
            Sign Out
          </button>
        </form>
      </section>
    </main>
  );
}
