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

  const proposalYear = String(proposal.proposal_number).slice(0, 4);
  const [
    { data: revisions, error: revisionsError },
    { data: contacts, error: contactsError },
    { data: latestAnnualProposal, error: latestAnnualProposalError },
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
    s.from("proposals")
      .select("proposal_number")
      .like("proposal_number", `${proposalYear}%`)
      .order("proposal_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (revisionsError) throw revisionsError;
  if (contactsError) throw contactsError;
  if (latestAnnualProposalError) throw latestAnnualProposalError;

  const revisionIds = (revisions ?? []).map(r => r.id);

  const [{ data: sections }, { data: fees }, { data: expenses }, { data: acceptances }] = await Promise.all([
    revisionIds.length ? s.from("proposal_sections").select("*").in("proposal_revision_id", revisionIds).order("sort_order") : Promise.resolve({ data: [] } as any),
    revisionIds.length ? s.from("proposal_fee_items").select("*").in("proposal_revision_id", revisionIds).order("sort_order") : Promise.resolve({ data: [] } as any),
    revisionIds.length ? s.from("proposal_expense_estimates").select("*").in("proposal_revision_id", revisionIds).order("sort_order") : Promise.resolve({ data: [] } as any),
    revisionIds.length ? s.from("proposal_acceptances").select("*").in("proposal_revision_id", revisionIds).order("accepted_at", { ascending: false }) : Promise.resolve({ data: [] } as any),
  ]);

  return {
    proposal,
    latestAnnualProposalNumber: latestAnnualProposal?.proposal_number ?? null,
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
      s.from("time_entries").select("*, source_additional_service_labor_item:additional_service_labor_items(additional_service:additional_services(authorization_number))").eq("project_id", projectId).order("work_date", { ascending: false }).limit(50),
      s.from("expenses").select("*, source_additional_service_expense_item:additional_service_expense_items(additional_service:additional_services(authorization_number))").eq("project_id", projectId).order("expense_date", { ascending: false }).limit(50),
      s.from("additional_services").select("*, acceptances:additional_service_acceptances(*)").eq("project_id", projectId).order("created_at", { ascending: false }),
      s.from("invoices").select("*").eq("project_id", projectId).order("invoice_date", { ascending: false }),
      s.from("project_financial_summary").select("*").eq("project_id", projectId).single(),
    ]);

  if (error) throw error;
  let sourceAcceptance = null;
  if (project.source_revision_id) {
    const { data, error: acceptanceError } = await s
      .from("proposal_acceptances")
      .select("signer_name,signer_title,signer_email,signer_mobile,accepted_at")
      .eq("proposal_revision_id", project.source_revision_id)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (acceptanceError) throw acceptanceError;
    sourceAcceptance = data;
  }
  return {
    project,
    sourceAcceptance,
    phases: phases ?? [],
    time: time ?? [],
    expenses: expenses ?? [],
    authorizations: authorizations ?? [],
    invoices: invoices ?? [],
    financial,
  };
}

export async function getAdditionalServiceDetail(additionalServiceId: string) {
  const s = createAdminClient();

  const [{ data: authorization, error }, { data: deliveries, error: deliveriesError }] = await Promise.all([
    s.from("additional_services").select(`
      *,
      project:projects(
        id,project_number,project_name,project_location,client_id,primary_contact_id,
        client:clients(id,company_name),
        primary_contact:contacts(id,first_name,last_name,title,email,mobile_phone)
      ),
      acceptances:additional_service_acceptances(*),
      labor_items:additional_service_labor_items(*),
      expense_items:additional_service_expense_items(*)
    `).eq("id", additionalServiceId).single(),
    s.from("document_deliveries")
      .select("id,delivery_method,recipient_name,recipient_address,status,error_message,sent_at,created_at")
      .eq("document_type", "additional_service")
      .eq("related_record_id", additionalServiceId)
      .order("created_at", { ascending: false }),
  ]);

  if (error) throw error;
  if (deliveriesError) throw deliveriesError;
  return { authorization, deliveries: deliveries ?? [] };
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
