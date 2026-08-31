import { NextRequest, NextResponse } from "next/server";
import { generateSecureToken, hashPublicToken } from "@/lib/security/tokens";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ proposalId: string }> }
) {
  const { proposalId } = await context.params;
  const body = await request.json();

  const rawToken = generateSecureToken();
  const tokenHash = hashPublicToken(rawToken);

  return NextResponse.json(
    {
      status: "scaffold",
      proposalId,
      delivery: body?.delivery ?? "sms",
      rawTokenMustOnlyBeUsedInOutboundLink: Boolean(rawToken),
      tokenHashMustBeStored: tokenHash,
      message:
        "Create share-link row, generate public URL, send via selected SMS/email adapter, and log delivery result.",
    },
    { status: 501 }
  );
}
