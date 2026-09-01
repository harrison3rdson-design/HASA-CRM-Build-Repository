"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  calculateExpenseAmount,
  calculateLaborAmount,
  EXPENSE_BILLING_RULES,
  type ExpenseBillingRule,
} from "@/lib/proposal-items";

export type LaborLineValue = {
  id: string;
  description: string;
  hours: string;
  rate: string;
};

export type ExpenseLineValue = {
  id: string;
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

const EMPTY_LABOR_LINES: LaborLineValue[] = [];
const EMPTY_EXPENSE_LINES: ExpenseLineValue[] = [];

function numericValue(value: string): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function blankLaborLine(id: string): LaborLineValue {
  return { id, description: "", hours: "", rate: "" };
}

function blankExpenseLine(id: string): ExpenseLineValue {
  return {
    id,
    category: "",
    description: "",
    quantity: "1",
    unit: "",
    rate: "",
    billingRule: "actual",
    markupPercent: "0",
    requiresReceipt: true,
  };
}

export function ProposalLineItemsFields({
  initialLaborLines = EMPTY_LABOR_LINES,
  initialExpenseLines = EMPTY_EXPENSE_LINES,
}: {
  initialLaborLines?: LaborLineValue[];
  initialExpenseLines?: ExpenseLineValue[];
}) {
  const headingPrefix = useId();
  const nextId = useRef(1);
  const [laborLines, setLaborLines] = useState<LaborLineValue[]>(() =>
    initialLaborLines.length ? initialLaborLines : [blankLaborLine("labor-initial")],
  );
  const [expenseLines, setExpenseLines] = useState<ExpenseLineValue[]>(() =>
    initialExpenseLines.length ? initialExpenseLines : [blankExpenseLine("expense-initial")],
  );

  const laborTotal = useMemo(
    () => laborLines.reduce(
      (sum, line) => sum + calculateLaborAmount(numericValue(line.hours), numericValue(line.rate)),
      0,
    ),
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

  const updateLaborLine = (id: string, patch: Partial<LaborLineValue>) => {
    setLaborLines((lines) => lines.map((line) => line.id === id ? { ...line, ...patch } : line));
  };
  const updateExpenseLine = (id: string, patch: Partial<ExpenseLineValue>) => {
    setExpenseLines((lines) => lines.map((line) => line.id === id ? { ...line, ...patch } : line));
  };

  return (
    <>
      <section className="full line-items-section" aria-labelledby={`${headingPrefix}-labor`}>
        <div className="line-items-heading">
          <div>
            <h2 id={`${headingPrefix}-labor`}>Services and Labor</h2>
            <p>Break down the estimated hours and hourly rate for each service.</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setLaborLines((lines) => [
              ...lines,
              blankLaborLine(`labor-new-${nextId.current++}`),
            ])}
          >
            Add Labor Line
          </button>
        </div>
        <input type="hidden" name="labor_count" value={laborLines.length} />
        <div className="line-items-list">
          {laborLines.map((line, index) => {
            const amount = calculateLaborAmount(numericValue(line.hours), numericValue(line.rate));
            const laborLineStarted = Boolean(line.description.trim() || line.hours || line.rate);
            return (
              <div className="line-item labor-line" key={line.id}>
                <label>
                  Description
                  <input
                    name={`labor_description_${index}`}
                    value={line.description}
                    required={laborLineStarted}
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
                    required={laborLineStarted}
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
                    required={laborLineStarted}
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

      <section className="full line-items-section" aria-labelledby={`${headingPrefix}-expenses`}>
        <div className="line-items-heading">
          <div>
            <h2 id={`${headingPrefix}-expenses`}>Estimated Expenses</h2>
            <p>Itemize reimbursable expenses and how each one will be billed.</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setExpenseLines((lines) => [
              ...lines,
              blankExpenseLine(`expense-new-${nextId.current++}`),
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
    </>
  );
}
