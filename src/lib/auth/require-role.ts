import type { AppRole } from "@/lib/auth/roles";
import { requireActiveUser } from "@/lib/auth/server";

export async function requireRole(allowed: readonly AppRole[]) {
  const { supabase, authUser, appUser } = await requireActiveUser();

  if (!allowed.includes(appUser.role)) {
    throw new Error("You do not have permission to perform this action.");
  }

  return {
    supabase,
    authUser,
    appUser,
  };
}
