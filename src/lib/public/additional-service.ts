import { createAdminClient } from "@/lib/supabase-admin";
import { hashPublicToken } from "@/lib/security/tokens";

export async function getPublicAuthorizationByToken(token: string) {
  const admin = createAdminClient();
  const tokenHash = hashPublicToken(token);

  const { data: link, error: linkError } = await admin
    .from("additional_service_share_links")
    .select("*")
    .eq("token_hash", tokenHash)
    .single();

  if (linkError) throw new Error("This authorization link is invalid.");
  if (link.revoked_at) throw new Error("This authorization link has been revoked.");
  if (link.expires_at && new Date(link.expires_at) < new Date()) throw new Error("This authorization link has expired.");

  await admin.rpc("register_additional_service_view", { p_token_hash: tokenHash });

  const [{ data: auth, error }, { data: company }] = await Promise.all([
    admin.from("additional_services").select(`
      *,
      project:projects(
        project_number,project_name,project_location,
        client:clients(company_name),
        primary_contact:contacts(first_name,last_name,title)
      ),
      labor_items:additional_service_labor_items(*),
      expense_items:additional_service_expense_items(*)
    `).eq("id", link.additional_service_id).single(),
    admin.from("company_settings").select("*").limit(1).single(),
  ]);

  if (error) throw error;
  return { authorization: auth, company };
}
