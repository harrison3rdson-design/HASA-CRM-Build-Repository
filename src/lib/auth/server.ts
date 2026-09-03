import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { AppRole } from "@/lib/auth/roles";

export type ActiveAppUser = {
  id: string;
  role: AppRole;
  active: true;
  default_bill_rate: number | null;
  internal_cost_rate: number | null;
};

export async function createAuthenticatedServerClient() {
  const cookieStore = await cookies();
  type CookieSetOptions = Parameters<typeof cookieStore.set>[2];

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options: CookieSetOptions }>
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components may not permit cookie mutation.
          }
        },
      },
    }
  );
}

export async function requireUser() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { supabase, authUser: user };
}

export async function getCurrentAppUser() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { supabase, authUser: null, appUser: null };
  }

  const { data, error } = await supabase
    .from("app_users")
    .select("id,role,active,default_bill_rate,internal_cost_rate")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  return {
    supabase,
    authUser: user,
    appUser: data ?? null,
  };
}

export async function requireActiveUser() {
  const { supabase, authUser, appUser } = await getCurrentAppUser();

  if (!authUser) {
    throw new Error("Authentication required.");
  }
  if (!appUser?.active) {
    throw new Error("Active application user required.");
  }

  return {
    supabase,
    authUser,
    appUser: appUser as ActiveAppUser,
  };
}

export async function getCurrentUser() {
  const supabase = await createAuthenticatedServerClient();
  const { data, error } = await supabase.auth.getUser();

  return {
    supabase,
    user: error ? null : data.user,
  };
}
