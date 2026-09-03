"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Policies } from "@/lib/auth/action-policy";
import { INTERNAL_ROLES, type AppRole } from "@/lib/auth/roles";
import { createAuthenticatedServerClient } from "@/lib/auth/server";
import { resolveAppUrl } from "@/lib/app-url";
import { TransactionalEmailProvider } from "@/lib/messaging/email";
import { createAdminClient } from "@/lib/supabase-admin";
import { boolValue, requiredText } from "@/lib/validation/common";

export type UserAdministrationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const idleState: UserAdministrationActionState = { status: "idle", message: "" };

function parseRole(value: FormDataEntryValue | null): AppRole {
  const role = String(value ?? "") as AppRole;
  if (!INTERNAL_ROLES.includes(role)) throw new Error("Select a valid access role.");
  return role;
}

function normalizeEmail(value: FormDataEntryValue | null): string {
  const email = requiredText(value, "Email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendAccountSetupEmail(input: {
  email: string;
  firstName: string;
  tokenHash: string;
  verificationType: "invite" | "magiclink";
  idempotencyKey: string;
}) {
  const setupUrl = new URL("/auth/confirm", resolveAppUrl());
  setupUrl.searchParams.set("token_hash", input.tokenHash);
  setupUrl.searchParams.set("type", input.verificationType);
  setupUrl.searchParams.set("next", "/accept-invite");

  const greeting = input.firstName ? `Hello ${input.firstName},` : "Hello,";
  const email = new TransactionalEmailProvider();
  const delivery = await email.sendEmail({
    to: input.email,
    subject: "HASA Concepts Management — Set up your account",
    text: `${greeting}\n\nYou have been granted access to HASA Concepts Management. Use the secure link below to set your password and open your account.\n\n${setupUrl.toString()}\n\nIf you were not expecting this invitation, you may ignore this email.`,
    html: `<p>${escapeHtml(greeting)}</p><p>You have been granted access to HASA Concepts Management.</p><p><a href="${escapeHtml(setupUrl.toString())}">Set up your account</a></p><p>If you were not expecting this invitation, you may ignore this email.</p>`,
    idempotencyKey: input.idempotencyKey,
  });

  if (delivery.status === "failed") {
    throw new Error(delivery.errorMessage ?? "The invitation email could not be sent.");
  }
}

async function writeAccessLog(input: {
  actorId: string;
  recordId: string;
  eventType: string;
  description: string;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("activity_log").insert({
    user_id: input.actorId,
    record_type: "app_user",
    record_id: input.recordId,
    event_type: input.eventType,
    event_description: input.description,
    previous_values: input.previousValues ?? null,
    new_values: input.newValues ?? null,
  });
  if (error) console.error("[users:audit] failed", { message: error.message });
}

export async function inviteUserAction(
  _previousState: UserAdministrationActionState = idleState,
  formData: FormData
): Promise<UserAdministrationActionState> {
  let createdAuthUserId: string | null = null;
  try {
    const { appUser } = await Policies.userAdministration();
    const firstName = requiredText(formData.get("first_name"), "First name");
    const lastName = requiredText(formData.get("last_name"), "Last name");
    const email = normalizeEmail(formData.get("email"));
    const role = parseRole(formData.get("role"));
    const admin = createAdminClient();

    const { data: existing, error: existingError } = await admin
      .from("app_users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) throw new Error("A user access record already exists for this email address.");

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { first_name: firstName, last_name: lastName } },
    });
    if (linkError) throw linkError;
    createdAuthUserId = linkData.user.id;

    const { data: createdUser, error: createError } = await admin
      .from("app_users")
      .insert({
        auth_user_id: createdAuthUserId,
        first_name: firstName,
        last_name: lastName,
        email,
        role,
        active: true,
      })
      .select("id")
      .single();
    if (createError) {
      await admin.auth.admin.deleteUser(createdAuthUserId);
      createdAuthUserId = null;
      throw createError;
    }

    await sendAccountSetupEmail({
      email,
      firstName,
      tokenHash: linkData.properties.hashed_token,
      verificationType: "invite",
      idempotencyKey: `user-invite/${createdUser.id}/${linkData.properties.hashed_token.slice(0, 12)}`,
    });

    await writeAccessLog({
      actorId: appUser.id,
      recordId: createdUser.id,
      eventType: "user.invited",
      description: `User invitation sent to ${email}.`,
      newValues: { email, role, active: true },
    });
    revalidatePath("/settings");
    return { status: "success", message: `Invitation sent to ${email}.` };
  } catch (error) {
    console.error("[users:invite] failed", {
      message: error instanceof Error ? error.message : String(error),
      createdAuthUserId,
    });
    revalidatePath("/settings");
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to invite this user.",
    };
  }
}

export async function manageUserAction(
  _previousState: UserAdministrationActionState = idleState,
  formData: FormData
): Promise<UserAdministrationActionState> {
  try {
    const { appUser } = await Policies.userAdministration();
    const userId = requiredText(formData.get("user_id"), "User");
    const intent = requiredText(formData.get("intent"), "Action");
    const admin = createAdminClient();

    const { data: target, error: targetError } = await admin
      .from("app_users")
      .select("id,auth_user_id,first_name,last_name,email,role,active")
      .eq("id", userId)
      .single();
    if (targetError) throw targetError;

    if (intent === "resend") {
      if (!target.auth_user_id) throw new Error("This user is not linked to a sign-in account.");
      if (!target.active) throw new Error("Reactivate this user before sending an account link.");
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: target.email,
      });
      if (linkError) throw linkError;
      await sendAccountSetupEmail({
        email: target.email,
        firstName: target.first_name ?? "",
        tokenHash: linkData.properties.hashed_token,
        verificationType: "magiclink",
        idempotencyKey: `user-account-link/${target.id}/${linkData.properties.hashed_token.slice(0, 12)}`,
      });
      await writeAccessLog({
        actorId: appUser.id,
        recordId: target.id,
        eventType: "user.account_link_sent",
        description: `Account setup link sent to ${target.email}.`,
      });
      return { status: "success", message: `Account setup link sent to ${target.email}.` };
    }

    if (intent !== "update") throw new Error("Select a valid user-management action.");
    const role = parseRole(formData.get("role"));
    const active = boolValue(formData.get("active"));

    if (target.id === appUser.id && (!active || role !== "owner_admin")) {
      throw new Error("You cannot deactivate or remove your own Owner Administrator access.");
    }

    if (target.role === "owner_admin" && target.active && (!active || role !== "owner_admin")) {
      const { count, error: countError } = await admin
        .from("app_users")
        .select("id", { count: "exact", head: true })
        .eq("role", "owner_admin")
        .eq("active", true);
      if (countError) throw countError;
      if ((count ?? 0) <= 1) throw new Error("At least one active Owner Administrator is required.");
    }

    const { error: updateError } = await admin
      .from("app_users")
      .update({ role, active })
      .eq("id", target.id);
    if (updateError) throw updateError;

    await writeAccessLog({
      actorId: appUser.id,
      recordId: target.id,
      eventType: "user.access_updated",
      description: `Access updated for ${target.email}.`,
      previousValues: { role: target.role, active: target.active },
      newValues: { role, active },
    });
    revalidatePath("/settings");
    return { status: "success", message: `Access updated for ${target.email}.` };
  } catch (error) {
    console.error("[users:manage] failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to update this user.",
    };
  }
}

export async function completeInvitationAction(
  _previousState: UserAdministrationActionState = idleState,
  formData: FormData
): Promise<UserAdministrationActionState> {
  const password = requiredText(formData.get("password"), "Password");
  const confirmation = requiredText(formData.get("password_confirmation"), "Password confirmation");
  if (password.length < 12) return { status: "error", message: "Use at least 12 characters for your password." };
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { status: "error", message: "Include an uppercase letter, a lowercase letter, and a number." };
  }
  if (password !== confirmation) return { status: "error", message: "The passwords do not match." };

  const supabase = await createAuthenticatedServerClient();
  const { data: current, error: currentError } = await supabase.auth.getUser();
  if (currentError || !current.user) return { status: "error", message: "This account link is invalid or expired." };

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("id,active")
    .eq("auth_user_id", current.user.id)
    .single();
  if (appUserError || !appUser?.active) return { status: "error", message: "This account does not have active application access." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { status: "error", message: error.message };
  redirect("/dashboard");
}
