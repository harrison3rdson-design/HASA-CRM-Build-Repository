import Link from "next/link";
import { Panel } from "@/components/cards";
import { ClientForm } from "@/components/forms/client-form";

export default function NewClientPage() {
  return (
    <>
      <div className="page-heading">
        <div><h1>New Client</h1><p>Add a client organization and its billing information.</p></div>
        <Link className="secondary-button" href="/clients">Back to Clients</Link>
      </div>
      <Panel title="Client Details">
        <ClientForm />
      </Panel>
    </>
  );
}
