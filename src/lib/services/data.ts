import { createAdminClient } from "@/lib/supabase-admin";
import { Policies } from "@/lib/auth/action-policy";

export async function serviceData() {
  const { appUser } = await Policies.internalRead();
  const db = createAdminClient();
  const results = await Promise.all([
    db.from("clients").select("id,company_name,active").order("company_name"),
    db.from("properties").select("*").order("name"),
    db
      .from("digital_twin_models")
      .select("*")
      .order("captured_on", { ascending: false }),
    db
      .from("service_agreements")
      .select("*")
      .order("created_at", { ascending: false }),
    db.from("service_agreement_properties").select("*"),
    db
      .from("service_work_entries")
      .select("*")
      .order("work_date", { ascending: false }),
    db.from("service_refresh_tasks").select("*").order("due_on"),
  ]);
  for (const r of results) if (r.error) throw r.error;
  return {
    clients: results[0].data ?? [],
    properties: results[1].data ?? [],
    models: results[2].data ?? [],
    agreements: results[3].data ?? [],
    coverage: results[4].data ?? [],
    work: results[5].data ?? [],
    refreshes: results[6].data ?? [],
    canManage: ["owner_admin", "project_manager"].includes(appUser.role),
    canBill: ["owner_admin", "project_manager", "accounting"].includes(
      appUser.role,
    ),
    canWork: ["owner_admin", "project_manager", "staff"].includes(appUser.role),
  };
}
