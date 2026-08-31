import type { AppRole } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/server";

export async function requireRole(allowed: AppRole[]) {
  const { supabase, authUser } = await requireUser();

  const { data, error } = await supabase
    .from("app_users")
    .select("id,role,active")
    .eq("auth_user_id", authUser.id)
    .single();

  if (error || !data?.active) {
    throw new Error("Active application user required.");
  }

  if (!allowed.includes(data.role as AppRole)) {
    throw new Error("You do not have permission to perform this action.");
  }

  return {
    supabase,
    authUser,
    appUser: data as { id: string; role: AppRole; active: boolean },
  };
}
