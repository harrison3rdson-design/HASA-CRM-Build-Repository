import { createAdminClient } from "@/lib/supabase-admin";

export async function getNextInvoiceNumber(projectId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("next_invoice_number", {
    p_project_id: projectId,
  });

  if (error) throw error;
  return data as string;
}

export async function markPastDueInvoices(): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("mark_past_due_invoices");

  if (error) throw error;
  return Number(data ?? 0);
}
