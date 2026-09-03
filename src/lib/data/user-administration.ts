import { Policies } from "@/lib/auth/action-policy";
import type { AppRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase-admin";

export type ManagedUser = {
  id: string;
  authUserId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: AppRole;
  active: boolean;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  createdAt: string;
};

export async function getManagedUsers(): Promise<{
  currentAppUserId: string;
  users: ManagedUser[];
}> {
  const { appUser } = await Policies.userAdministration();
  const admin = createAdminClient();

  const [{ data: appUsers, error: appUsersError }, { data: authUsers, error: authUsersError }] =
    await Promise.all([
      admin
        .from("app_users")
        .select("id,auth_user_id,first_name,last_name,email,role,active,created_at")
        .order("last_name", { ascending: true, nullsFirst: false })
        .order("first_name", { ascending: true, nullsFirst: false }),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

  if (appUsersError) throw appUsersError;
  if (authUsersError) throw authUsersError;

  const authById = new Map(authUsers.users.map((user) => [user.id, user]));

  return {
    currentAppUserId: appUser.id,
    users: (appUsers ?? []).map((user) => {
      const authUser = user.auth_user_id ? authById.get(user.auth_user_id) : undefined;
      return {
        id: user.id,
        authUserId: user.auth_user_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role as AppRole,
        active: user.active,
        emailConfirmedAt: authUser?.email_confirmed_at ?? null,
        lastSignInAt: authUser?.last_sign_in_at ?? null,
        createdAt: user.created_at,
      };
    }),
  };
}
