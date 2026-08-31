import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createAuthenticatedServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
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
  const supabase = await createAuthenticatedServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Authentication required.");
  }

  return { supabase, authUser: data.user };
}
