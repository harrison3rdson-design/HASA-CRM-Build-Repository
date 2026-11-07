import { Panel } from "@/components/cards";
import { InvoiceForm } from "@/components/forms/invoice-form";
import { getInvoiceFormData } from "@/lib/data/app-data";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const { projects, clients, defaultPaymentTerms } = await getInvoiceFormData();
  const invoiceDate = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="page-heading">
        <div><h1>New Invoice</h1><p>Create an invoice from an approved project or bill a customer directly.</p></div>
      </div>
      <Panel title="Invoice Details">
        <InvoiceForm key={projectId ?? "unscoped"} projects={projects} clients={clients} defaultPaymentTerms={defaultPaymentTerms} invoiceDate={invoiceDate} selectedProjectId={projectId} />
      </Panel>
    </>
  );
}
