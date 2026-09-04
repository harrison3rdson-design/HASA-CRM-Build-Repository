import { createAdminClient } from "@/lib/supabase-admin";
import { Policies } from "@/lib/auth/action-policy";

export async function getClientDetail(clientId: string) {
  await Policies.internalRead();
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
  await Policies.internalRead();
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
    { data: companySettings, error: companySettingsError },
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
    s.from("company_settings")
      .select("default_proposal_terms")
      .limit(1)
      .single(),
  ]);

  if (revisionsError) throw revisionsError;
  if (contactsError) throw contactsError;
  if (latestAnnualProposalError) throw latestAnnualProposalError;
  if (companySettingsError) throw companySettingsError;

  const revisionIds = (revisions ?? []).map(r => r.id);

  const [
    { data: sections },
    { data: fees },
    { data: expenses },
    { data: materials },
    { data: acceptances },
    { data: deliveries, error: deliveriesError },
  ] = await Promise.all([
    revisionIds.length ? s.from("proposal_sections").select("*").in("proposal_revision_id", revisionIds).order("sort_order") : Promise.resolve({ data: [] } as any),
    revisionIds.length ? s.from("proposal_fee_items").select("*").in("proposal_revision_id", revisionIds).order("sort_order") : Promise.resolve({ data: [] } as any),
    revisionIds.length ? s.from("proposal_expense_estimates").select("*").in("proposal_revision_id", revisionIds).order("sort_order") : Promise.resolve({ data: [] } as any),
    revisionIds.length ? s.from("proposal_material_items").select("*").in("proposal_revision_id", revisionIds).order("sort_order") : Promise.resolve({ data: [] } as any),
    revisionIds.length ? s.from("proposal_acceptances").select(`
      *,
      recorded_by_user:app_users(first_name,last_name,email),
      evidence_document:documents(id,title,original_filename)
    `).in("proposal_revision_id", revisionIds).order("accepted_at", { ascending: false }) : Promise.resolve({ data: [] } as any),
    s.from("document_deliveries")
      .select("id,delivery_method,recipient_name,recipient_address,status,error_message,sent_at,created_at")
      .eq("document_type", "proposal")
      .eq("related_record_id", proposalId)
      .order("created_at", { ascending: false }),
  ]);
  if (deliveriesError) throw deliveriesError;

  return {
    proposal,
    latestAnnualProposalNumber: latestAnnualProposal?.proposal_number ?? null,
    companyDefaultProposalTerms: companySettings.default_proposal_terms,
    contacts: contacts ?? [],
    revisions: revisions ?? [],
    sections: sections ?? [],
    fees: fees ?? [],
    expenses: expenses ?? [],
    materials: materials ?? [],
    acceptances: acceptances ?? [],
    deliveries: deliveries ?? [],
  };
}

export async function getProjectDetail(projectId: string) {
  await Policies.internalRead();
  const s = createAdminClient();

  const [{ data: project, error }, { data: phases }, { data: time }, { data: unitServices, error: unitServicesError }, { data: expenses }, { data: authorizations }, { data: invoices }, { data: financial }] =
    await Promise.all([
      s.from("projects").select("*, client:clients(*), primary_contact:contacts(*)").eq("id", projectId).single(),
      s.from("project_phases").select("*").eq("project_id", projectId).order("sort_order"),
      s.from("time_entries").select("*, source_additional_service_labor_item:additional_service_labor_items(additional_service:additional_services(authorization_number))").eq("project_id", projectId).order("work_date", { ascending: false }).limit(50),
      s.from("unit_service_entries").select("*, source_fee_item:proposal_fee_items(description)").eq("project_id", projectId).order("work_date", { ascending: false }).limit(50),
      s.from("expenses").select("*, source_additional_service_expense_item:additional_service_expense_items(additional_service:additional_services(authorization_number))").eq("project_id", projectId).order("expense_date", { ascending: false }).limit(50),
      s.from("additional_services").select("*, acceptances:additional_service_acceptances(*)").eq("project_id", projectId).order("created_at", { ascending: false }),
      s.from("invoices").select("*").eq("project_id", projectId).order("invoice_date", { ascending: false }),
      s.from("project_financial_summary").select("*").eq("project_id", projectId).single(),
    ]);

  if (error) throw error;
  if (unitServicesError) throw unitServicesError;
  let sourceAcceptance = null;
  let unitServiceOptions: Array<{
    id: string;
    description: string;
    quantity: number | string;
    unit: string;
    rate: number | string;
  }> = [];
  if (project.source_revision_id) {
    const [
      { data, error: acceptanceError },
      { data: serviceOptions, error: serviceOptionsError },
    ] = await Promise.all([
      s.from("proposal_acceptances")
        .select("signer_name,signer_title,signer_email,signer_mobile,accepted_at")
        .eq("proposal_revision_id", project.source_revision_id)
        .order("accepted_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      s.from("proposal_fee_items")
        .select("id,description,quantity,unit,rate")
        .eq("proposal_revision_id", project.source_revision_id)
        .eq("billing_type", "unit")
        .order("sort_order"),
    ]);
    if (acceptanceError) throw acceptanceError;
    if (serviceOptionsError) throw serviceOptionsError;
    sourceAcceptance = data;
    unitServiceOptions = serviceOptions ?? [];
  }
  return {
    project,
    sourceAcceptance,
    phases: phases ?? [],
    time: time ?? [],
    unitServices: unitServices ?? [],
    unitServiceOptions,
    expenses: expenses ?? [],
    authorizations: authorizations ?? [],
    invoices: invoices ?? [],
    financial,
  };
}

export async function getAdditionalServiceDetail(additionalServiceId: string) {
  await Policies.internalRead();
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
  await Policies.internalRead();
  const s = createAdminClient();

  const [{ data: invoice, error }, { data: items }, { data: payments }, { data: deliveries }] =
    await Promise.all([
      s.from("invoices").select("*, client:clients(*), project:projects(*, primary_contact:contacts(id,first_name,last_name,email,mobile_phone))").eq("id", invoiceId).single(),
      s.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("sort_order"),
      s.from("payments").select("*").eq("invoice_id", invoiceId).order("payment_date", { ascending: false }),
      s.from("document_deliveries").select("*").eq("document_type", "invoice").eq("related_record_id", invoiceId).order("created_at", { ascending: false }),
    ]);

  if (error) throw error;
  const [
    { data: latestProjectInvoice, error: latestInvoiceError },
    { data: billingContext, error: billingContextError },
    { data: priorInvoices, error: priorInvoicesError },
  ] = await Promise.all([
    s.from("invoices")
      .select("invoice_number")
      .eq("project_id", invoice.project_id)
      .order("invoice_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    s.from("project_invoice_context")
      .select("authorized_fee,service_fee_authorized,billing_method")
      .eq("id", invoice.project_id)
      .single(),
    s.from("invoices")
      .select("id,invoice_number,invoice_date,invoice_type,status,total,amount_paid,balance_due")
      .eq("project_id", invoice.project_id)
      .neq("id", invoiceId)
      .neq("status", "void")
      .order("invoice_number"),
  ]);
  if (latestInvoiceError) throw latestInvoiceError;
  if (billingContextError) throw billingContextError;
  if (priorInvoicesError) throw priorInvoicesError;

  const priorInvoiceIds = (priorInvoices ?? []).map((priorInvoice) => priorInvoice.id);
  const { data: priorItems, error: priorItemsError } = priorInvoiceIds.length
    ? await s.from("invoice_items").select("invoice_id,item_type,amount").in("invoice_id", priorInvoiceIds)
    : { data: [], error: null };
  if (priorItemsError) throw priorItemsError;

  const serviceItemTypes = new Set(["professional_fee", "progress", "hourly", "travel_time", "unit_service", "additional_service"]);
  const priorServiceBilled = (priorItems ?? []).reduce((sum, item) => (
    serviceItemTypes.has(item.item_type) ? sum + Number(item.amount) : sum
  ), 0);
  const currentServiceBilled = (items ?? []).reduce((sum, item) => (
    serviceItemTypes.has(item.item_type) ? sum + Number(item.amount) : sum
  ), 0);

  return {
    invoice,
    latestProjectInvoiceNumber: latestProjectInvoice?.invoice_number ?? null,
    items: items ?? [],
    payments: payments ?? [],
    deliveries: deliveries ?? [],
    priorInvoices: priorInvoices ?? [],
    reconciliation: {
      billingMethod: billingContext.billing_method,
      authorizedFee: Number(billingContext.authorized_fee),
      authorizedServiceFee: Number(billingContext.service_fee_authorized),
      priorServiceBilled,
      currentServiceBilled,
      remainingServiceFee: Math.max(
        Number(billingContext.service_fee_authorized) - priorServiceBilled - currentServiceBilled,
        0,
      ),
    },
  };
}
