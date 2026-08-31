import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/login-form";
import { getCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user } = await getCurrentUser();
  if (user) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand login-brand"><div className="brand-mark">HASA</div><div className="brand-sub">CONCEPTS</div></div>
        <h1>Management Sign In</h1>
        <p>Sign in with your HASA Concepts account to manage company settings and records.</p>
        <LoginForm error={error} />
      </section>
    </main>
  );
}
