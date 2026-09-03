import { createAdminClient } from "@/lib/supabase-admin";
import { parsePaymentTerms } from "@/lib/payment-terms";
import type { ProjectWorkOption } from "@/lib/project-work-options";

export async function getDashboardData(){
  const s=createAdminClient();
  const [{data:proposals},{data:projects},{data:invoices},{data:receipts}] = await Promise.all([
    s.from("proposals").select("id,status"),
    s.from("projects").select("id,status"),
    s.from("invoices").select("id,status,balance_due"),
    s.from("receipt_inbox").select("id,status")
  ]);
  const open=new Set(["draft","sent","viewed","changes_requested"]);
  return {
    openProposals:(proposals??[]).filter(x=>open.has(x.status)).length,
    activeProjects:(projects??[]).filter(x=>x.status==="active").length,
    outstandingAR:(invoices??[]).filter(x=>!["paid","void"].includes(x.status)).reduce((n,x)=>n+Number(x.balance_due??0),0),
    pastDue:(invoices??[]).filter(x=>x.status==="past_due").reduce((n,x)=>n+Number(x.balance_due??0),0),
    unassignedReceipts:(receipts??[]).filter(x=>x.status==="unassigned").length
  };
}

async function q(table:string, select:string, order?:string){
  const s=createAdminClient();
  let query=s.from(table).select(select);
  if(order) query=query.order(order,{ascending:false});
  const {data,error}=await query;
  if(error) throw error;
  return data??[];
}

export const getClients=()=>q("clients","id,client_number,company_name,email,phone,active","company_name");
export const getProposals=()=>q("proposals","id,proposal_number,project_name,status,current_revision,client:clients(company_name)","created_at");
export const getProjects=()=>q("project_financial_summary","*","project_number");
export const getTimeEntries=()=>q("time_entries","id,work_date,activity_type,description,hours,billable,billing_rate,is_travel_time,locked,invoice_item_id,source_fee_item_id,source_additional_service_labor_item:additional_service_labor_items(additional_service:additional_services(authorization_number)),project:projects(project_number,project_name)","work_date");
export const getExpenses=()=>q("expenses","id,expense_date,category,vendor,actual_cost,billable_amount,billing_rule,source_estimate_id,source_material_id,source_additional_service_expense_item:additional_service_expense_items(additional_service:additional_services(authorization_number)),project:projects(project_number,project_name)","expense_date");
export const getReceiptInbox=()=>q("receipt_inbox","id,original_filename,mime_type,captured_at,status,project_id,expense_id","captured_at");
export const getInvoices=()=>q("invoices","id,invoice_number,invoice_date,due_date,status,total,amount_paid,balance_due,invoice_type,client:clients(company_name),project:projects(project_number,project_name)","invoice_date");
export const getDocuments=()=>q("documents","id,title,document_type,document_subtype,document_date,locked,storage_path","created_at");

export async function getProjectOptions() {
  const s = createAdminClient();
  const { data, error } = await s
    .from("projects")
    .select("id,project_number,project_name")
    .eq("status", "active")
    .order("project_number");
  if (error) throw error;
  return data ?? [];
}

export async function getProjectWorkOptions(): Promise<ProjectWorkOption[]> {
  const s = createAdminClient();
  const { data: projects, error: projectsError } = await s
    .from("projects")
    .select("id,project_number,project_name,source_revision_id")
    .eq("status", "active")
    .order("project_number");
  if (projectsError) throw projectsError;

  const revisionIds = [...new Set(
    (projects ?? [])
      .map((project) => project.source_revision_id)
      .filter((id): id is string => Boolean(id)),
  )];

  const projectIds = (projects ?? []).map((project) => project.id);
  const [laborResult, expenseResult, materialResult, authorizationResult] = await Promise.all([
    revisionIds.length
      ?
        s.from("proposal_fee_items")
          .select("id,proposal_revision_id,description,billing_type,quantity,rate")
          .in("proposal_revision_id", revisionIds)
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    revisionIds.length
      ?
        s.from("proposal_expense_estimates")
          .select("id,proposal_revision_id,category,description,estimated_rate,estimated_amount,billing_rule,markup_percent,requires_receipt")
          .in("proposal_revision_id", revisionIds)
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    revisionIds.length
      ? s.from("proposal_material_items")
          .select("id,proposal_revision_id,description,unit_cost,amount,markup_percent")
          .in("proposal_revision_id", revisionIds)
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? s.from("additional_services")
          .select("id,project_id,authorization_number")
          .in("project_id", projectIds)
          .eq("status", "accepted")
          .order("authorization_number")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (laborResult.error) throw laborResult.error;
  if (expenseResult.error) throw expenseResult.error;
  if (materialResult.error) throw materialResult.error;
  if (authorizationResult.error) throw authorizationResult.error;

  const authorizationIds = (authorizationResult.data ?? []).map((authorization) => authorization.id);
  const [additionalLaborResult, additionalExpenseResult] = authorizationIds.length
    ? await Promise.all([
        s.from("additional_service_labor_items")
          .select("id,additional_service_id,description,hours,rate")
          .in("additional_service_id", authorizationIds)
          .order("sort_order"),
        s.from("additional_service_expense_items")
          .select("id,additional_service_id,category,description,estimated_rate,estimated_amount,billing_rule,markup_percent,requires_receipt")
          .in("additional_service_id", authorizationIds)
          .order("sort_order"),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (additionalLaborResult.error) throw additionalLaborResult.error;
  if (additionalExpenseResult.error) throw additionalExpenseResult.error;

  return (projects ?? []).map((project) => ({
    ...project,
    labor_categories: [
      ...(laborResult.data ?? [])
        .filter((item) => item.proposal_revision_id === project.source_revision_id)
        .map(({ proposal_revision_id: _revisionId, ...item }) => ({
          ...item,
          source_kind: "proposal" as const,
          source_label: "Original Proposal",
        })),
      ...(authorizationResult.data ?? []).flatMap((authorization) =>
        authorization.project_id === project.id
          ? (additionalLaborResult.data ?? [])
              .filter((item) => item.additional_service_id === authorization.id)
              .map(({ additional_service_id: _authorizationId, hours: quantity, ...item }) => ({
                ...item,
                quantity,
                billing_type: "hourly",
                source_kind: "additional_service" as const,
                source_label: authorization.authorization_number,
              }))
          : [],
      ),
    ],
    expense_categories: [
      ...(expenseResult.data ?? [])
        .filter((item) => item.proposal_revision_id === project.source_revision_id)
        .map(({ proposal_revision_id: _revisionId, ...item }) => ({
          ...item,
          source_kind: "proposal" as const,
          source_label: "Original Proposal",
        })),
      ...(materialResult.data ?? [])
        .filter((item) => item.proposal_revision_id === project.source_revision_id)
        .map(({ proposal_revision_id: _revisionId, unit_cost, amount, markup_percent, description, ...item }) => ({
          ...item,
          category: "Materials",
          description,
          estimated_rate: unit_cost,
          estimated_amount: amount,
          billing_rule: Number(markup_percent) > 0 ? "actual_plus_markup" : "actual",
          markup_percent,
          requires_receipt: true,
          source_kind: "material" as const,
          source_label: "Original Proposal Materials",
        })),
      ...(authorizationResult.data ?? []).flatMap((authorization) =>
        authorization.project_id === project.id
          ? (additionalExpenseResult.data ?? [])
              .filter((item) => item.additional_service_id === authorization.id)
              .map(({ additional_service_id: _authorizationId, ...item }) => ({
                ...item,
                source_kind: "additional_service" as const,
                source_label: authorization.authorization_number,
              }))
          : [],
      ),
    ],
  }));
}

export async function getCompanySettings(){
  const s=createAdminClient();
  const {data,error}=await s.from("company_settings").select("*").limit(1).single();
  if(error) throw error;
  return data;
}

export async function getProposalFormData() {
  const s = createAdminClient();
  const [{ data: clients, error: clientsError }, { data: settings, error: settingsError }] = await Promise.all([
    s.from("clients")
      .select("id,client_number,company_name,contacts(id,first_name,last_name,email,mobile_phone,is_primary)")
      .eq("active", true)
      .order("company_name"),
    s.from("company_settings").select("default_payment_terms").limit(1).single(),
  ]);

  if (clientsError) throw clientsError;
  if (settingsError) throw settingsError;

  return {
    clients: (clients ?? []).map((client) => ({
      ...client,
      contacts: [...(client.contacts ?? [])].sort((left, right) => Number(right.is_primary) - Number(left.is_primary)),
    })),
    defaultPaymentTerms: parsePaymentTerms(settings.default_payment_terms, "Default payment terms"),
  };
}

export async function getInvoiceFormData() {
  const s = createAdminClient();
  const [{ data: projects, error: projectsError }, { data: settings, error: settingsError }] = await Promise.all([
    s.from("project_invoice_context")
      .select("id,project_number,project_name,source_revision_id,authorized_fee,service_fee_authorized,billing_method")
      .eq("status", "active")
      .order("project_number"),
    s.from("company_settings").select("default_payment_terms").limit(1).single(),
  ]);

  if (projectsError) throw projectsError;
  if (settingsError) throw settingsError;

  const defaultPaymentTerms = parsePaymentTerms(settings.default_payment_terms, "Default payment terms");
  const revisionIds = (projects ?? []).map((project) => project.source_revision_id).filter(Boolean) as string[];
  let termsByRevision = new Map<string, unknown>();
  if (revisionIds.length) {
    const { data: revisions, error: revisionsError } = await s
      .from("proposal_revisions")
      .select("id,payment_terms")
      .in("id", revisionIds);
    if (revisionsError) throw revisionsError;
    termsByRevision = new Map((revisions ?? []).map((revision) => [revision.id, revision.payment_terms]));
  }

  return {
    projects: (projects ?? []).map((project) => ({
      id: project.id,
      project_number: project.project_number,
      project_name: project.project_name,
      billing_method: project.billing_method,
      authorized_fee: Number(project.authorized_fee),
      service_fee_authorized: Number(project.service_fee_authorized),
      payment_terms: parsePaymentTerms(
        (project.source_revision_id && termsByRevision.get(project.source_revision_id)) || defaultPaymentTerms
      ),
    })),
    defaultPaymentTerms,
  };
}
