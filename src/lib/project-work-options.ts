export type ProposalLaborCategory = {
  id: string;
  description: string;
  billing_type: string;
  quantity: number | string;
  rate: number | string;
};

export type ProposalExpenseCategory = {
  id: string;
  category: string;
  description: string | null;
  estimated_rate: number | string | null;
  estimated_amount: number | string;
  billing_rule: string;
  markup_percent: number | string;
  requires_receipt: boolean;
};

export type ProjectWorkOption = {
  id: string;
  project_number: string;
  project_name: string;
  source_revision_id: string | null;
  labor_categories: ProposalLaborCategory[];
  expense_categories: ProposalExpenseCategory[];
};
