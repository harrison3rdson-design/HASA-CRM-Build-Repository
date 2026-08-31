import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) {
  const params = await context.params;
  return NextResponse.json({
    status: "scaffold",
    params,
    message: "Connect this route to the authenticated Supabase server client.",
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) {
  const params = await context.params;
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(
    {
      status: "scaffold",
      params,
      received: body,
      message: "Validation, role checks, audit logging, and persistence are required before production.",
    },
    { status: 501 }
  );
}
