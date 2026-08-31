"use server";

import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase-admin";

export async function voidInvoiceAction(invoiceId:string){
  await requireRole(["owner_admin","accounting"]);
  const admin=createAdminClient();
  const {error}=await admin.from("invoices").update({status:"void",locked:true}).eq("id",invoiceId);
  if(error) throw error;
}

export async function updateUserRoleAction(userId:string,role:"owner_admin"|"project_manager"|"staff"|"accounting"|"read_only"){
  await requireRole(["owner_admin"]);
  const admin=createAdminClient();
  const {error}=await admin.from("app_users").update({role}).eq("id",userId);
  if(error) throw error;
}
