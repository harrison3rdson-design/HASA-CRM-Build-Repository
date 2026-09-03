"use server";

import { redirect } from "next/navigation";
import { getMfaStatus, isMfaVerified } from "@/lib/auth/mfa";
import { createAuthenticatedServerClient } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requiredText } from "@/lib/validation/common";

export async function signInAction(formData: FormData) {
  const email = requiredText(formData.get("email"), "Email").toLowerCase();
  const password = requiredText(formData.get("password"), "Password");
  const captchaToken = String(formData.get("captchaToken") ?? "").trim();
  if (!captchaToken || captchaToken.length > 4096) {
    redirect("/login?error=" + encodeURIComponent("Please complete the security verification and try again."));
  }
  const supabase = await createAuthenticatedServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });

  if (error || !data.user) {
    const message = error?.message.toLowerCase().includes("captcha")
      ? "Security verification failed or expired. Please try again."
      : "The email or password is incorrect.";
    redirect("/login?error=" + encodeURIComponent(message));
  }

  const admin = createAdminClient();
  const { data: appUser, error: appUserError } = await admin
    .from("app_users")
    .select("active")
    .eq("auth_user_id", data.user.id)
    .single();

  if (appUserError || !appUser?.active) {
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent("This account does not have active application access.")}`);
  }

  const mfaStatus = await getMfaStatus(supabase);
  redirect(isMfaVerified(mfaStatus) ? "/dashboard" : "/mfa");
}

export async function signOutAction() {
  const supabase = await createAuthenticatedServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
