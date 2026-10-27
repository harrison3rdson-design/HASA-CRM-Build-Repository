import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel, MetricCard } from "@/components/cards";
import { ActionForm } from "@/components/services/action-form";
import { ServiceTermsSummary } from "@/components/services/terms-summary";
import { serviceData } from "@/lib/services/data";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  todayInNewYork,
  calendarMonthMinutes,
  monthlyTotal,
} from "@/lib/services/terms";
import { money } from "@/lib/ui/format";
import {
  setCoverageAction,
  activateAgreementAction,
  cancelAgreementAction,
  generateServiceInvoicesAction,
  saveServiceWorkAction,
  saveRefreshAction,
  completeRefreshAction,
} from "@/app/actions/services";
export default async function Page({
  params,
}: {
  params: Promise<{ agreementId: string }>;
}) {
  const { agreementId } = await params;
  const d = await serviceData();
  const a = d.agreements.find((a) => a.id === agreementId);
  if (!a) notFound();
  const db = createAdminClient();
  const [{ data: invoices, error }, { data: revision, error: revisionError }] =
    await Promise.all([
      db
        .from("invoices")
        .select("id,invoice_number,invoice_date,total,status")
        .eq("service_agreement_id", a.id)
        .order("invoice_date", { ascending: false }),
      db
        .from("proposal_revisions")
        .select("proposal_id")
        .eq("id", a.source_revision_id)
        .single(),
    ]);
  if (error) throw error;
  if (revisionError) throw revisionError;
  const coverage = d.coverage.filter((c) => c.agreement_id === a.id);
  const propertyIds = new Set(coverage.map((c) => c.property_id));
  const properties = d.properties.filter((p) => propertyIds.has(p.id));
  const capacity = d.models
    .filter((m) => propertyIds.has(m.property_id) && m.hosted)
    .reduce((sum, m) => sum + m.capacity_units, 0);
  const work = d.work.filter((w) => w.agreement_id === a.id);
  const tasks = d.refreshes.filter((t) => t.agreement_id === a.id);
  const today = todayInNewYork();
  const used = calendarMonthMinutes(work, today);
  const hidden = <input type="hidden" name="agreement_id" value={a.id} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            {a.agreement_number} · {a.terms.name}
          </h1>
          <p>
            {d.clients.find((c) => c.id === a.client_id)?.company_name} ·{" "}
            {a.status} · {a.starts_on ?? "Start not set"} through{" "}
            {a.ends_on ? `${a.ends_on} (exclusive)` : "term not set"}
          </p>
        </div>
        <Link
          className="secondary-button"
          href={`/proposals/${revision.proposal_id}`}
        >
          Accepted Proposal
        </Link>
      </div>
      <div className="metric-grid">
        <MetricCard
          label="Monthly Agreement Fee"
          value={money(monthlyTotal(a.terms))}
        />
        <MetricCard
          label="Hosted Capacity / Allowance"
          value={`${capacity} / ${a.terms.modelAllowance}`}
        />
        <MetricCard
          label="Maintenance Used / Included"
          value={`${used} / ${a.terms.maintenanceMinutes} min`}
        />
      </div>
      {capacity > a.terms.modelAllowance && (
        <p role="alert">
          Hosted capacity exceeds the agreement allowance. Arrange additional
          capacity before adding more models; no automatic overage is charged.
        </p>
      )}
      {used > a.terms.maintenanceMinutes && (
        <p role="alert">
          Maintenance exceeds the included monthly time. Additional billable
          work requires separate approval; no overage is invoiced automatically.
        </p>
      )}
      <Panel title="Accepted Scope and Pricing">
        <ServiceTermsSummary terms={a.terms} />
      </Panel>
      <Panel title="Covered Properties">
        {properties.map((p) => (
          <div key={p.id}>
            <p>
              <Link href={`/properties/${p.id}`}>{p.name}</Link> · {p.address}
            </p>
            {a.status === "draft" && d.canManage && (
              <ActionForm
                action={setCoverageAction}
                button="Remove from Agreement"
              >
                {hidden}
                <input type="hidden" name="property_id" value={p.id} />
                <input type="hidden" name="remove" value="true" />
              </ActionForm>
            )}
          </div>
        ))}
        {!properties.length && (
          <p>Link the properties described in the accepted scope.</p>
        )}
        {d.canManage && a.status === "draft" && (
          <ActionForm action={setCoverageAction} button="Add Covered Property">
            {hidden}
            <label>
              Property
              <select name="property_id" required defaultValue="">
                <option value="" disabled>
                  Select property
                </option>
                {d.properties
                  .filter(
                    (p) =>
                      p.client_id === a.client_id &&
                      p.active &&
                      !propertyIds.has(p.id),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <Link href={`/properties?clientId=${a.client_id}`}>
              Create a property
            </Link>
          </ActionForm>
        )}
      </Panel>
      {a.status === "draft" && d.canManage && (
        <Panel title="Activate Agreement">
          <ActionForm
            action={activateAgreementAction}
            button="Activate Monthly Service"
          >
            {hidden}
            <label>
              Agreed service start
              <input
                type="date"
                name="starts_on"
                defaultValue={today}
                required
              />
            </label>
            <label className="check full">
              <input type="checkbox" name="confirmed" required />
              The covered properties match the accepted scope, delivery is
              ready, and the client agreed to this start date. Billing starts on
              this date; backdated activation generates all due periods.
            </label>
          </ActionForm>
        </Panel>
      )}
      <Panel title="Monthly Invoices">
        <p>
          Draft invoices require review and sending in Billing. Cancellation
          stops future generation and does not void existing invoices.
        </p>
        {d.canBill && a.status === "active" && (
          <ActionForm
            action={generateServiceInvoicesAction}
            button="Generate Due Draft Invoices"
          >
            {hidden}
          </ActionForm>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Period start</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices?.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={`/billing/${i.id}`}>{i.invoice_number}</Link>
                  </td>
                  <td>{i.invoice_date}</td>
                  <td>{money(i.total)}</td>
                  <td>{i.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Remote Maintenance">
        <p>
          Allowance resets each calendar month without rollover. Record actual
          minutes here; this log does not automatically create billable project
          time.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Work</th>
                <th>Minutes</th>
              </tr>
            </thead>
            <tbody>
              {work.map((w) => (
                <tr key={w.id}>
                  <td>{w.work_date}</td>
                  <td>{w.description}</td>
                  <td>{w.minutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.canWork && a.status !== "draft" && (
          <ActionForm action={saveServiceWorkAction} button="Log Maintenance">
            {hidden}
            <label>
              Work date
              <input
                name="work_date"
                type="date"
                required
                defaultValue={today}
                max={today}
              />
            </label>
            <label>
              Minutes
              <input name="minutes" type="number" min="1" max="1440" required />
            </label>
            <label className="full">
              Work performed
              <textarea name="description" required />
            </label>
          </ActionForm>
        )}
      </Panel>
      <Panel title="Scheduled Refresh Visits">
        <p>
          Check the accepted scope, travel allowance and collected refresh fees
          before performing a visit.
        </p>
        {tasks.map((t) => (
          <div key={t.id}>
            <p>
              <strong>{t.due_on}</strong> · {t.scope} · {t.status}
            </p>
            {t.status === "planned" && d.canManage && (
              <ActionForm action={completeRefreshAction} button="Update Visit">
                {hidden}
                <input type="hidden" name="task_id" value={t.id} />
                <label>
                  Outcome
                  <select name="status">
                    <option value="complete">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </ActionForm>
            )}
          </div>
        ))}
        {d.canManage && a.status === "active" && (
          <ActionForm action={saveRefreshAction} button="Schedule Refresh">
            {hidden}
            <label>
              Visit date
              <input name="due_on" type="date" required min={a.starts_on} />
            </label>
            <label>
              Property, areas and visit scope
              <textarea name="scope" required />
            </label>
          </ActionForm>
        )}
      </Panel>
      {d.canManage && a.status === "active" && (
        <Panel title="Stop Recurring Service">
          <ActionForm action={cancelAgreementAction} button="Cancel Agreement">
            {hidden}
            <label className="check full">
              <input type="checkbox" name="confirmed" required />
              Cancel further invoice generation. Existing invoices remain, and
              any outstanding contractual charges require separate review. Model
              hosting is not changed automatically.
            </label>
          </ActionForm>
        </Panel>
      )}
    </>
  );
}
