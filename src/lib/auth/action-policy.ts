import { requireRole } from "@/lib/auth/require-role";
import { INTERNAL_ROLES } from "@/lib/auth/roles";

export const Policies = {
  internalRead: () => requireRole(INTERNAL_ROLES),
  clientWrite: () => requireRole(["owner_admin","project_manager"]),
  contactWrite: () => requireRole(["owner_admin","project_manager"]),
  proposalWrite: () => requireRole(["owner_admin","project_manager"]),
  proposalSend: () => requireRole(["owner_admin","project_manager"]),
  projectWrite: () => requireRole(["owner_admin","project_manager"]),
  timeOwn: () => requireRole(["owner_admin","project_manager","staff"]),
  unitServiceOwn: () => requireRole(["owner_admin","project_manager","staff"]),
  expenseWrite: () => requireRole(["owner_admin","project_manager","staff","accounting"]),
  invoiceCreate: () => requireRole(["owner_admin","project_manager","accounting"]),
  invoiceWrite: () => requireRole(["owner_admin","accounting"]),
  invoiceIssue: () => requireRole(["owner_admin","accounting"]),
  paymentPost: () => requireRole(["owner_admin","accounting"]),
  documentWrite: () => requireRole(["owner_admin","project_manager","staff","accounting"]),
  companySettings: () => requireRole(["owner_admin"]),
  userAdministration: () => requireRole(["owner_admin"]),
} as const;
