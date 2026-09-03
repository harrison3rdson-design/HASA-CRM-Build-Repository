import { NextResponse } from "next/server";
import { Policies } from "@/lib/auth/action-policy";
import { getProjectFinancialSummary } from "@/lib/projects/financials";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  await Policies.internalRead();
  const { projectId } = await context.params;
  const summary = await getProjectFinancialSummary(projectId);
  return NextResponse.json(summary);
}
