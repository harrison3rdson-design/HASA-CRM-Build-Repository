import { NextRequest, NextResponse } from "next/server";
import { hashPublicToken } from "@/lib/security/tokens";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const tokenHash = hashPublicToken(token);

  return NextResponse.json(
    {
      status: "scaffold",
      tokenHashGenerated: Boolean(tokenHash),
      message:
        "Lookup token hash server-side, validate expiry/revocation, register view, then return only the customer-safe proposal model.",
    },
    { status: 501 }
  );
}
