export type AppRole =
  | "owner_admin"
  | "project_manager"
  | "staff"
  | "accounting"
  | "read_only";

export function canIssueInvoices(role: AppRole): boolean {
  return role === "owner_admin" || role === "accounting";
}

export function canCreateInvoices(role: AppRole): boolean {
  return ["owner_admin", "project_manager", "accounting"].includes(role);
}

export function canManageProjects(role: AppRole): boolean {
  return role === "owner_admin" || role === "project_manager";
}

export function canRecordPayments(role: AppRole): boolean {
  return role === "owner_admin" || role === "accounting";
}
