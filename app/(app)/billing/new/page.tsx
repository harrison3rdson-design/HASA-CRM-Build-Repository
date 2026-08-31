import { Panel } from "@/components/cards";
import { InvoiceForm } from "@/components/forms/invoice-form";
import { getInvoiceFormData } from "@/lib/data/app-data";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const { projects, defaultPaymentTerms } = await getInvoiceFormData();
  const invoiceDate = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="page-heading">
        <div><h1>New Invoice</h1><p>Terms default from the project’s accepted proposal revision.</p></div>
      </div>
      <Panel title="Invoice Details">
        <InvoiceForm projects={projects} defaultPaymentTerms={defaultPaymentTerms} invoiceDate={invoiceDate} />
      </Panel>
    </>
  );
}
