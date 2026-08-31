import { createAdminClient } from "@/lib/supabase-admin";

export async function getProjectFinancialSummary(projectId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("project_financial_summary")
    .select("*")
    .eq("project_id", projectId)
    .single();

  if (error) throw error;
  return data;
}
