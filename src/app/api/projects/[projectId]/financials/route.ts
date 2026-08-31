import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { getProjectFinancialSummary } from "@/lib/projects/financials";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  await requireUser();
  const { projectId } = await context.params;
  const summary = await getProjectFinancialSummary(projectId);
  return NextResponse.json(summary);
}
