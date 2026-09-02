import { createClient } from "@supabase/supabase-js";
import { createClockSkewRetryFetch } from "@/lib/supabase-clock-skew";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Supabase server environment variables are not configured.");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: createClockSkewRetryFetch(),
    },
  });
}
