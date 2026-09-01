import { createAdminClient } from "@/lib/supabase-admin";
import { parsePaymentTerms } from "@/lib/payment-terms";

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
export const getTimeEntries=()=>q("time_entries","id,work_date,activity_type,description,hours,billable,billing_rate,is_travel_time,project:projects(project_number,project_name)","work_date");
export const getExpenses=()=>q("expenses","id,expense_date,category,vendor,actual_cost,billable_amount,billing_rule,project:projects(project_number,project_name)","expense_date");
export const getReceiptInbox=()=>q("receipt_inbox","id,original_filename,mime_type,captured_at,status,project_id,expense_id","captured_at");
export const getInvoices=()=>q("invoices","id,invoice_number,invoice_date,due_date,status,total,amount_paid,balance_due,invoice_type,client:clients(company_name),project:projects(project_number,project_name)","invoice_date");
export const getDocuments=()=>q("documents","id,title,document_type,document_subtype,document_date,locked,storage_path","created_at");

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
    s.from("projects")
      .select("id,project_number,project_name,source_revision_id")
      .eq("status", "active")
      .order("project_number"),
    s.from("company_settings").select("default_payment_terms").limit(1).single(),
  ]);

  if (projectsError) throw projectsError;
  if (settingsError) throw settingsError;

  const defaultPaymentTerms = parsePaymentTerms(settings.default_payment_terms, "Default payment terms");
  const revisionIds = (projects ?? [])
    .map((project) => project.source_revision_id)
    .filter((id): id is string => Boolean(id));

  let termsByRevision = new Map<string, string>();
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
      payment_terms: parsePaymentTerms(
        (project.source_revision_id && termsByRevision.get(project.source_revision_id)) || defaultPaymentTerms
      ),
    })),
    defaultPaymentTerms,
  };
}
