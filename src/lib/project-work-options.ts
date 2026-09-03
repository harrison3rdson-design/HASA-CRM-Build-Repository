export type ApprovedLaborCategory = {
  id: string;
  source_kind: "proposal" | "additional_service";
  source_label: string;
  description: string;
  billing_type: string;
  quantity: number | string;
  rate: number | string;
};

export type ApprovedExpenseCategory = {
  id: string;
  source_kind: "proposal" | "material" | "additional_service";
  source_label: string;
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
  labor_categories: ApprovedLaborCategory[];
  expense_categories: ApprovedExpenseCategory[];
};
