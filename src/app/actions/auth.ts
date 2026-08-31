"use server";

import { redirect } from "next/navigation";
import { createAuthenticatedServerClient } from "@/lib/auth/server";
import { requiredText } from "@/lib/validation/common";

export async function signInAction(formData: FormData) {
  const email = requiredText(formData.get("email"), "Email").toLowerCase();
  const password = requiredText(formData.get("password"), "Password");
  const supabase = await createAuthenticatedServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect(`/login?error=${encodeURIComponent("The email or password is incorrect.")}`);
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("active")
    .eq("auth_user_id", data.user.id)
    .single();

  if (appUserError || !appUser?.active) {
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent("This account does not have active application access.")}`);
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createAuthenticatedServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
