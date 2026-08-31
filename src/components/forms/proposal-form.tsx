"use client";

import { useMemo, useRef, useState } from "react";
import { createProposalAction } from "@/app/actions/proposals";
import { PAYMENT_TERMS, type PaymentTerms } from "@/lib/payment-terms";
import {
  calculateExpenseAmount,
  calculateLaborAmount,
  EXPENSE_BILLING_RULES,
  type ExpenseBillingRule,
} from "@/lib/proposal-items";

type ClientOption = {
  id: string;
  client_number: string;
  company_name: string;
};

type LaborLine = { id: number; description: string; hours: string; rate: string };
type ExpenseLine = {
  id: number;
  category: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  billingRule: ExpenseBillingRule;
  markupPercent: string;
  requiresReceipt: boolean;
};

const expenseRuleLabels: Record<ExpenseBillingRule, string> = {
  actual: "Actual cost",
  actual_plus_markup: "Actual + markup",
  fixed_rate: "Fixed rate",
  per_diem: "Per diem",
  mileage: "Mileage",
  allowance: "Allowance",
  included: "Included in fee",
  not_billable: "Not billable",
};

function numericValue(value: string): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function ProposalForm({
  clients,
  defaultPaymentTerms,
}: {
  clients: ClientOption[];
  defaultPaymentTerms: PaymentTerms;
}) {
  const nextId = useRef(3);
  const [laborLines, setLaborLines] = useState<LaborLine[]>([
    { id: 1, description: "", hours: "", rate: "" },
  ]);
  const [expenseLines, setExpenseLines] = useState<ExpenseLine[]>([
    {
      id: 2,
      category: "",
      description: "",
      quantity: "1",
      unit: "",
      rate: "",
      billingRule: "actual",
      markupPercent: "0",
      requiresReceipt: true,
    },
  ]);

  const laborTotal = useMemo(
    () => laborLines.reduce((sum, line) => sum + calculateLaborAmount(numericValue(line.hours), numericValue(line.rate)), 0),
    [laborLines],
  );
  const expenseTotal = useMemo(
    () => expenseLines.reduce(
      (sum, line) => sum + calculateExpenseAmount(
        numericValue(line.quantity),
        numericValue(line.rate),
        numericValue(line.markupPercent),
        line.billingRule,
      ),
      0,
    ),
    [expenseLines],
  );

  const updateLaborLine = (id: number, patch: Partial<LaborLine>) => {
    setLaborLines((lines) => lines.map((line) => line.id === id ? { ...line, ...patch } : line));
  };
  const updateExpenseLine = (id: number, patch: Partial<ExpenseLine>) => {
    setExpenseLines((lines) => lines.map((line) => line.id === id ? { ...line, ...patch } : line));
  };

  return (
    <form action={createProposalAction} className="form-grid">
      <label>
        Proposal Number
        <input value="Assigned automatically when saved" readOnly aria-describedby="proposal-number-help" />
        <span id="proposal-number-help">Annual sequence: YYYY0151, YYYY0152, YYYY0153…</span>
      </label>
      <label>
        Client
        <select name="client_id" required>
          <option value="">Select client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.client_number} — {client.company_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Project Name
        <input name="project_name" required />
      </label>
      <label>
        Project Location
        <input name="project_location" />
      </label>
      <label>
        Payment Terms
        <select name="payment_terms" defaultValue={defaultPaymentTerms} required>
          {PAYMENT_TERMS.map((terms) => <option key={terms} value={terms}>{terms}</option>)}
        </select>
      </label>
      <label>
        Validity (Days)
        <input name="validity_days" type="number" min="1" defaultValue="15" required />
      </label>
      <label>
        Billing Method
        <select name="billing_method" defaultValue="fixed_fee">
          <option value="fixed_fee">Fixed fee</option>
          <option value="hourly">Hourly</option>
          <option value="milestone">Milestone</option>
          <option value="time_and_materials">Time and materials</option>
        </select>
      </label>

      <section className="full line-items-section" aria-labelledby="labor-heading">
        <div className="line-items-heading">
          <div>
            <h2 id="labor-heading">Services and Labor</h2>
            <p>Break down the estimated hours and hourly rate for each service.</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setLaborLines((lines) => [
              ...lines,
              { id: nextId.current++, description: "", hours: "", rate: "" },
            ])}
          >
            Add Labor Line
          </button>
        </div>
        <input type="hidden" name="labor_count" value={laborLines.length} />
        <div className="line-items-list">
          {laborLines.map((line, index) => {
            const amount = calculateLaborAmount(numericValue(line.hours), numericValue(line.rate));
            return (
              <div className="line-item labor-line" key={line.id}>
                <label>
                  Description
                  <input
                    name={`labor_description_${index}`}
                    value={line.description}
                    onChange={(event) => updateLaborLine(line.id, { description: event.target.value })}
                    placeholder="Design services"
                  />
                </label>
                <label>
                  Hours
                  <input
                    name={`labor_hours_${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.hours}
                    onChange={(event) => updateLaborLine(line.id, { hours: event.target.value })}
                    placeholder="0"
                  />
                </label>
                <label>
                  Hourly Rate
                  <input
                    name={`labor_rate_${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.rate}
                    onChange={(event) => updateLaborLine(line.id, { rate: event.target.value })}
                    placeholder="$0.00"
                  />
                </label>
                <div className="line-item-amount"><span>Amount</span><strong>{currency(amount)}</strong></div>
                <button
                  className="text-button remove-line"
                  type="button"
                  onClick={() => setLaborLines((lines) => lines.filter((candidate) => candidate.id !== line.id))}
                  disabled={laborLines.length === 1}
                  aria-label={`Remove labor line ${index + 1}`}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
        <div className="line-items-subtotal"><span>Professional Fee</span><strong>{currency(laborTotal)}</strong></div>
      </section>

      <section className="full line-items-section" aria-labelledby="expenses-heading">
        <div className="line-items-heading">
          <div>
            <h2 id="expenses-heading">Estimated Expenses</h2>
            <p>Itemize reimbursable expenses and how each one will be billed.</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setExpenseLines((lines) => [
              ...lines,
              {
                id: nextId.current++,
                category: "",
                description: "",
                quantity: "1",
                unit: "",
                rate: "",
                billingRule: "actual",
                markupPercent: "0",
                requiresReceipt: true,
              },
            ])}
          >
            Add Expense Line
          </button>
        </div>
        <input type="hidden" name="expense_count" value={expenseLines.length} />
        <div className="line-items-list">
          {expenseLines.map((line, index) => {
            const amount = calculateExpenseAmount(
              numericValue(line.quantity),
              numericValue(line.rate),
              numericValue(line.markupPercent),
              line.billingRule,
            );
            return (
              <div className="line-item expense-line" key={line.id}>
                <label>
                  Category
                  <input
                    name={`expense_category_${index}`}
                    value={line.category}
                    onChange={(event) => updateExpenseLine(line.id, { category: event.target.value })}
                    placeholder="Travel"
                  />
                </label>
                <label className="expense-description">
                  Description
                  <input
                    name={`expense_description_${index}`}
                    value={line.description}
                    onChange={(event) => updateExpenseLine(line.id, { description: event.target.value })}
                    placeholder="Site visit airfare"
                  />
                </label>
                <label>
                  Quantity
                  <input
                    name={`expense_quantity_${index}`}
                    type="number"
                    min="0"
                    step="0.001"
                    value={line.quantity}
                    onChange={(event) => updateExpenseLine(line.id, { quantity: event.target.value })}
                  />
                </label>
                <label>
                  Unit
                  <input
                    name={`expense_unit_${index}`}
                    value={line.unit}
                    onChange={(event) => updateExpenseLine(line.id, { unit: event.target.value })}
                    placeholder="trip, mile, day"
                  />
                </label>
                <label>
                  Unit Cost
                  <input
                    name={`expense_rate_${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.rate}
                    onChange={(event) => updateExpenseLine(line.id, { rate: event.target.value })}
                    placeholder="$0.00"
                  />
                </label>
                <label>
                  Billing Rule
                  <select
                    name={`expense_billing_rule_${index}`}
                    value={line.billingRule}
                    onChange={(event) => updateExpenseLine(line.id, { billingRule: event.target.value as ExpenseBillingRule })}
                  >
                    {EXPENSE_BILLING_RULES.map((rule) => <option key={rule} value={rule}>{expenseRuleLabels[rule]}</option>)}
                  </select>
                </label>
                <label>
                  Markup %
                  <input
                    name={`expense_markup_${index}`}
                    type="number"
                    min="0"
                    max="999.999"
                    step="0.001"
                    value={line.markupPercent}
                    onChange={(event) => updateExpenseLine(line.id, { markupPercent: event.target.value })}
                    disabled={line.billingRule !== "actual_plus_markup"}
                  />
                </label>
                <label className="check receipt-check">
                  <input
                    name={`expense_requires_receipt_${index}`}
                    type="checkbox"
                    checked={line.requiresReceipt}
                    onChange={(event) => updateExpenseLine(line.id, { requiresReceipt: event.target.checked })}
                  />
                  Receipt required
                </label>
                <div className="line-item-amount"><span>Estimate</span><strong>{currency(amount)}</strong></div>
                <button
                  className="text-button remove-line"
                  type="button"
                  onClick={() => setExpenseLines((lines) => lines.filter((candidate) => candidate.id !== line.id))}
                  disabled={expenseLines.length === 1}
                  aria-label={`Remove expense line ${index + 1}`}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
        <div className="line-items-subtotal"><span>Estimated Expenses</span><strong>{currency(expenseTotal)}</strong></div>
      </section>

      <div className="full proposal-estimate-total">
        <span>Estimated Proposal Total</span>
        <strong>{currency(laborTotal + expenseTotal)}</strong>
      </div>
      <div className="full">
        <button className="primary-button" type="submit">Create Proposal</button>
      </div>
    </form>
  );
}
