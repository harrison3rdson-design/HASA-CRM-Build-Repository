export type UserRole =
  | "owner_admin"
  | "project_manager"
  | "staff"
  | "accounting"
  | "read_only";

export type ProposalStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "changes_requested"
  | "accepted"
  | "declined"
  | "expired"
  | "superseded";

export type ProjectStatus =
  | "pending"
  | "active"
  | "on_hold"
  | "complete"
  | "closed"
  | "cancelled";

export interface Client {
  id: string;
  client_number: number;
  company_name: string;
  billing_name?: string | null;
  phone?: string | null;
  email?: string | null;
  active: boolean;
}

export interface ProposalRevision {
  id: string;
  proposal_id: string;
  revision_number: number;
  professional_fee: number;
  estimated_expenses: number;
  estimated_materials: number;
  estimated_total: number;
  payment_terms: string;
  validity_days: number;
  locked: boolean;
}
