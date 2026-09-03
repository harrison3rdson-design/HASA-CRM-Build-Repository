import { createAdminClient } from "@/lib/supabase-admin";
import { hashPublicToken } from "@/lib/security/tokens";

export async function getPublicProposalByToken(token: string) {
  const admin = createAdminClient();
  const tokenHash = hashPublicToken(token);

  const { data: link, error: linkError } = await admin
    .from("proposal_share_links")
    .select("*")
    .eq("token_hash", tokenHash)
    .single();

  if (linkError) throw new Error("This proposal link is invalid.");
  if (link.revoked_at) throw new Error("This proposal link has been revoked.");
  if (link.expires_at && new Date(link.expires_at) < new Date()) throw new Error("This proposal link has expired.");

  await admin.rpc("register_proposal_view", { p_token_hash: tokenHash });

  const { data: revision, error: revisionError } = await admin
    .from("proposal_revisions")
    .select(`
      *,
      proposal:proposals(
        id,proposal_number,project_name,project_location,status,
        client:clients(id,company_name),
        primary_contact:contacts(first_name,last_name,title)
      )
    `)
    .eq("id", link.proposal_revision_id)
    .single();

  if (revisionError) throw revisionError;

  const [{ data: sections }, { data: fees }, { data: expenses }, { data: materials }, { data: company }] = await Promise.all([
    admin.from("proposal_sections").select("*").eq("proposal_revision_id", revision.id).order("sort_order"),
    admin.from("proposal_fee_items").select("*").eq("proposal_revision_id", revision.id).order("sort_order"),
    admin.from("proposal_expense_estimates").select("*").eq("proposal_revision_id", revision.id).order("sort_order"),
    admin.from("proposal_material_items").select("*").eq("proposal_revision_id", revision.id).order("sort_order"),
    admin.from("company_settings").select("*").limit(1).single(),
  ]);

  return {
    revision,
    proposal: revision.proposal,
    sections: sections ?? [],
    fees: fees ?? [],
    expenses: expenses ?? [],
    materials: materials ?? [],
    company,
  };
}
