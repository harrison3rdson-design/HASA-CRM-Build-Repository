import type {
  AuthenticatorAssuranceLevels,
  SupabaseClient,
} from "@supabase/supabase-js";

export type MfaStatus = {
  currentLevel: AuthenticatorAssuranceLevels | null;
  nextLevel: AuthenticatorAssuranceLevels | null;
  verifiedFactorId: string | null;
};

export async function getMfaStatus(
  supabase: SupabaseClient
): Promise<MfaStatus> {
  const [
    { data: assurance, error: assuranceError },
    { data: factors, error: factorsError },
  ] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);

  if (assuranceError) throw assuranceError;
  if (factorsError) throw factorsError;

  const verifiedTotpFactor = factors.totp.find(
    (factor) => factor.status === "verified"
  );

  return {
    currentLevel: assurance.currentLevel,
    nextLevel: assurance.nextLevel,
    verifiedFactorId: verifiedTotpFactor?.id ?? null,
  };
}

export function isMfaVerified(status: MfaStatus) {
  return status.currentLevel === "aal2";
}
