import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { sha256Hex } from "@/lib/security/tokens";

export function createRawShareToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export async function createProposalShareLink(
  revisionId: string,
  expiresInDays = 15,
  options: { revokeExisting?: boolean } = {},
) {
  const admin = createAdminClient();
  const token = createRawShareToken();
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();

  if (options.revokeExisting !== false) {
    await admin.from("proposal_share_links").update({ revoked_at: new Date().toISOString() })
      .eq("proposal_revision_id", revisionId).is("revoked_at", null);
  }

  const { error } = await admin.from("proposal_share_links").insert({
    proposal_revision_id: revisionId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (error) throw error;

  return { token, tokenHash, expiresAt };
}

export async function createAdditionalServiceShareLink(additionalServiceId: string, expiresInDays = 15) {
  const admin = createAdminClient();
  const token = createRawShareToken();
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();

  await admin.from("additional_service_share_links").update({ revoked_at: new Date().toISOString() })
    .eq("additional_service_id", additionalServiceId).is("revoked_at", null);

  const { error } = await admin.from("additional_service_share_links").insert({
    additional_service_id: additionalServiceId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (error) throw error;

  return { token, expiresAt };
}
