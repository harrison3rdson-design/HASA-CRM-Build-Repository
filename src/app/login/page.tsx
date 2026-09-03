import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/login-form";
import { getMfaStatus, isMfaVerified } from "@/lib/auth/mfa";
import { getCurrentAppUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase, authUser, appUser } = await getCurrentAppUser();
  if (authUser && appUser?.active) {
    const mfaStatus = await getMfaStatus(supabase);
    redirect(isMfaVerified(mfaStatus) ? "/dashboard" : "/mfa");
  }
  const { error } = await searchParams;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand login-brand"><div className="brand-mark">HASA</div><div className="brand-sub">CONCEPTS</div></div>
        <h1>Management Sign In</h1>
        <p>Sign in with your HASA Concepts account to manage company settings and records.</p>
        <LoginForm error={error} siteKey={siteKey} />
      </section>
    </main>
  );
}
