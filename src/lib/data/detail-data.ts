import { createAdminClient } from "@/lib/supabase-admin";

export async function getClientDetail(clientId: string) {
  const s = createAdminClient();

  const [{ data: client, error: clientError }, { data: contacts }, { data: proposals }, { data: projects }] =
    await Promise.all([
      s.from("clients").select("*").eq("id", clientId).single(),
      s.from("contacts").select("*").eq("client_id", clientId).order("is_primary", { ascending: false }),
      s.from("proposals").select("id,proposal_number,project_name,status,current_revision,created_at").eq("client_id", clientId).order("created_at", { ascending: false }),
      s.from("projects").select("id,project_number,project_name,status,authorized_fee").eq("client_id", clientId).order("project_number"),
    ]);

  if (clientError) throw clientError;
  return { client, contacts: contacts ?? [], proposals: proposals ?? [], projects: projects ?? [] };
}

export async function getProposalDetail(proposalId: string) {
  const s = createAdminClient();

  const { data: proposal, error } = await s
    .from("proposals")
    .select(`
      *,
      client:clients(*),
      primary_contact:contacts(*)
    `)
    .eq("id", proposalId)
    .single();

  if (error) throw error;

  const [
    { data: revisions, error: revisionsError },
    { data: contacts, error: contactsError },
  ] = await Promise.all([
    s.from("proposal_revisions")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("revision_number", { ascending: false }),
    s.from("contacts")
      .select("id,first_name,last_name,email,mobile_phone,is_primary")
      .eq("client_id", proposal.client_id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);

  if (revisionsError) throw revisionsError;
  if (contactsError) throw contactsError;

  const revisionIds = (revisions ?? []).map(r => r.id);

  const [{ data: sections }, { data: fees }, { data: expenses }, { data: acceptances }] = await Promise.all([
    revisionIds.length ? s.from("proposal_sections").select("*").in("proposal_revision_id", revisionIds).order("sort_order") : Promise.resolve({ data: [] } as any),
    revisionIds.length ? s.from("proposal_fee_items").select("*").in("proposal_revision_id", revisionIds).order("sort_order") : Promise.resolve({ data: [] } as any),
    revisionIds.length ? s.from("proposal_expense_estimates").select("*").in("proposal_revision_id", revisionIds).order("sort_order") : Promise.resolve({ data: [] } as any),
    revisionIds.length ? s.from("proposal_acceptances").select("*").in("proposal_revision_id", revisionIds) : Promise.resolve({ data: [] } as any),
  ]);

  return {
    proposal,
    contacts: contacts ?? [],
    revisions: revisions ?? [],
    sections: sections ?? [],
    fees: fees ?? [],
    expenses: expenses ?? [],
    acceptances: acceptances ?? [],
  };
}

export async function getProjectDetail(projectId: string) {
  const s = createAdminClient();

  const [{ data: project, error }, { data: phases }, { data: time }, { data: expenses }, { data: authorizations }, { data: invoices }, { data: financial }] =
    await Promise.all([
      s.from("projects").select("*, client:clients(*), primary_contact:contacts(*)").eq("id", projectId).single(),
      s.from("project_phases").select("*").eq("project_id", projectId).order("sort_order"),
      s.from("time_entries").select("*").eq("project_id", projectId).order("work_date", { ascending: false }).limit(50),
      s.from("expenses").select("*").eq("project_id", projectId).order("expense_date", { ascending: false }).limit(50),
      s.from("additional_services").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      s.from("invoices").select("*").eq("project_id", projectId).order("invoice_date", { ascending: false }),
      s.from("project_financial_summary").select("*").eq("project_id", projectId).single(),
    ]);

  if (error) throw error;
  return {
    project,
    phases: phases ?? [],
    time: time ?? [],
    expenses: expenses ?? [],
    authorizations: authorizations ?? [],
    invoices: invoices ?? [],
    financial,
  };
}

export async function getInvoiceDetail(invoiceId: string) {
  const s = createAdminClient();

  const [{ data: invoice, error }, { data: items }, { data: payments }, { data: deliveries }] =
    await Promise.all([
      s.from("invoices").select("*, client:clients(*), project:projects(*)").eq("id", invoiceId).single(),
      s.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("sort_order"),
      s.from("payments").select("*").eq("invoice_id", invoiceId).order("payment_date", { ascending: false }),
      s.from("document_deliveries").select("*").eq("document_type", "invoice").eq("related_record_id", invoiceId).order("created_at", { ascending: false }),
    ]);

  if (error) throw error;
  return { invoice, items: items ?? [], payments: payments ?? [], deliveries: deliveries ?? [] };
}
