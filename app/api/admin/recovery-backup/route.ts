import { Policies } from "@/lib/auth/action-policy";
import { createApplicationRecoveryBackup } from "@/lib/recovery/create-backup";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function responseHeaders(fileName?: string) {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Content-Type-Options": "nosniff",
    ...(fileName
      ? { "Content-Disposition": `attachment; filename="${fileName}"` }
      : {}),
  };
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json(
      { error: "This backup request was not made from the management application." },
      { status: 403, headers: responseHeaders() },
    );
  }

  try {
    await Policies.userAdministration();
  } catch {
    return Response.json(
      { error: "Owner Administrator access with MFA is required." },
      { status: 403, headers: responseHeaders() },
    );
  }

  try {
    const backup = await createApplicationRecoveryBackup(createAdminClient());
    const timestamp = backup.createdAt.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
    const fileName = `hasa-recovery-${timestamp}.json`;
    return new Response(`${JSON.stringify(backup, null, 2)}\n`, {
      status: 200,
      headers: {
        ...responseHeaders(fileName),
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("[recovery-backup] generation failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "The recovery backup could not be generated. No data was changed." },
      { status: 500, headers: responseHeaders() },
    );
  }
}
