import { NextResponse } from "next/server";
import { Policies } from "@/lib/auth/action-policy";
import { createAdminClient } from "@/lib/supabase-admin";
import { hasAppUrl } from "@/lib/app-url";
import { isTwilioConfigured } from "@/lib/messaging/twilio";
import { isTransactionalEmailConfigured } from "@/lib/messaging/email";

export async function GET() {
  try {
    await Policies.companySettings();
    const admin = createAdminClient();

    const checks: Record<string, boolean> = {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      appUrl: hasAppUrl(),
      documentsBucket: !!process.env.DOCUMENTS_BUCKET,
      receiptsBucket: !!process.env.RECEIPTS_BUCKET,
      twilio: isTwilioConfigured(),
      email: isTransactionalEmailConfigured(),
    };

    const { error } = await admin.from("company_settings").select("id").limit(1);
    checks.database = !error;

    return NextResponse.json({
      ready: Object.values(checks).every(Boolean),
      checks,
      runtime: process.version,
    });
  } catch (e:any) {
    return NextResponse.json({ ready:false, error:e?.message ?? "Health check failed." }, { status:403 });
  }
}
