import Link from "next/link";
import { Panel } from "@/components/cards";
import { AdditionalServiceEditForm } from "@/components/forms/additional-service-edit-form";
import { SendAdditionalServiceButton } from "@/components/additional-services/send-additional-service-button";
import { getAdditionalServiceDetail } from "@/lib/data/detail-data";
import { createSignedDocumentUrl } from "@/lib/storage/private-storage";
import { isTwilioConfigured } from "@/lib/messaging/twilio";
import { isTransactionalEmailConfigured } from "@/lib/messaging/email";
import { dateTime, money } from "@/lib/ui/format";

function label(value: string) {
  return value.split("_").map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(" ");
}

export default async function AdditionalServiceDetailPage({
  params,
}: {
  params: Promise<{ authorizationId: string }>;
}) {
  const { authorizationId } = await params;
  const { authorization: a, deliveries } = await getAdditionalServiceDetail(authorizationId);
  const project = Array.isArray(a.project) ? a.project[0] : a.project;
  const contact = Array.isArray(project?.primary_contact)
    ? project.primary_contact[0]
    : project?.primary_contact;
  const acceptance = Array.isArray(a.acceptances) ? a.acceptances[0] : a.acceptances;
  const editable = a.status === "draft" && !a.locked;
  const executedPdfUrl = a.executed_pdf_path
    ? await createSignedDocumentUrl(a.executed_pdf_path, 60 * 60)
    : null;

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Authorization {a.authorization_number}</h1>
          <p>{project?.project_number} — {project?.project_name}</p>
        </div>
        <Link className="secondary-button" href={`/projects/${a.project_id}`}>Back to Project</Link>
      </div>

      <section className="proposal-area proposal-work-area" aria-labelledby="authorization-work-area-title">
        <header className="proposal-area-heading">
          <div>
            <span className="proposal-area-eyebrow">Authorization Work Area</span>
            <h2 id="authorization-work-area-title">Build and send this additional service</h2>
            <p>{editable
              ? "The description, billing type, and amount remain editable until the authorization is successfully sent."
              : "This authorization is locked because it has been sent. Its issued terms can no longer be edited."}</p>
          </div>
          <div className="button-row proposal-area-actions">
            <Link
              aria-label="Preview customer view (opens in a new tab)"
              className="secondary-button"
              href={`/additional-service-previews/${authorizationId}`}
              rel="noreferrer"
              target="_blank"
            >
              Preview Customer View
            </Link>
            {editable ? (
              <SendAdditionalServiceButton
                additionalServiceId={authorizationId}
                hasEmail={Boolean(contact?.email)}
                hasMobile={Boolean(contact?.mobile_phone)}
                emailConfigured={isTransactionalEmailConfigured()}
                smsConfigured={isTwilioConfigured()}
              />
            ) : null}
            {executedPdfUrl ? (
              <a className="primary-button" href={executedPdfUrl} rel="noreferrer" target="_blank">
                Open Executed PDF
              </a>
            ) : null}
          </div>
        </header>

        {editable ? (
          <Panel title="Edit Authorization">
            <p className="footnote">Sending this document permanently locks it. Preview the customer view before sending.</p>
            <AdditionalServiceEditForm authorization={a} />
          </Panel>
        ) : (
          <Panel title="Issued Authorization">
            <p className="preline">{a.description}</p>
          </Panel>
        )}
      </section>

      <section className="proposal-area proposal-summary-area" aria-labelledby="authorization-summary-title">
        <header className="proposal-area-heading">
          <div>
            <span className="proposal-area-eyebrow">Authorization Summary</span>
            <h2 id="authorization-summary-title">Review status and customer approval</h2>
            <p>Draft → Sent → Viewed → Accepted. Customer approval adds this amount to the project authorization.</p>
          </div>
          <span className="proposal-area-badge">{label(a.status)}</span>
        </header>

        <div className="summary-grid">
          <div><span>Client</span><strong>{project?.client?.company_name ?? "—"}</strong></div>
          <div><span>Billing Type</span><strong>{label(a.billing_type)}</strong></div>
          <div><span>Authorized Amount</span><strong>{money(a.authorized_amount)}</strong></div>
          <div><span>Locked</span><strong>{a.locked ? "Yes" : "No"}</strong></div>
        </div>

        <Panel title="Customer Approval">
          {acceptance ? (
            <dl className="detail-grid">
              <div><dt>Approved by</dt><dd>{acceptance.signer_name}{acceptance.signer_title ? `, ${acceptance.signer_title}` : ""}</dd></div>
              <div><dt>Approval date</dt><dd>{dateTime(acceptance.accepted_at)}</dd></div>
              <div><dt>Email</dt><dd>{acceptance.signer_email ?? "—"}</dd></div>
              <div><dt>Mobile</dt><dd>{acceptance.signer_mobile ?? "—"}</dd></div>
            </dl>
          ) : (
            <p className="muted">{editable
              ? "Not yet sent for customer approval."
              : "Awaiting customer approval."}</p>
          )}
        </Panel>

        <Panel title="Delivery History">
          {deliveries.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Method</th><th>Recipient</th><th>Address</th><th>Status</th><th>Details</th></tr></thead>
                <tbody>{deliveries.map((delivery: any) => (
                  <tr key={delivery.id}>
                    <td>{dateTime(delivery.sent_at ?? delivery.created_at)}</td>
                    <td>{label(delivery.delivery_method)}</td>
                    <td>{delivery.recipient_name || "—"}</td>
                    <td>{delivery.recipient_address}</td>
                    <td>{label(delivery.status)}</td>
                    <td>{delivery.error_message ?? "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="muted">This authorization has not been sent.</p>}
        </Panel>
      </section>
    </>
  );
}
