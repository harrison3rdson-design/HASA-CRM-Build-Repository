import { NextResponse } from "next/server";
import { Policies } from "@/lib/auth/action-policy";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  try {
    await Policies.companySettings();
    const admin = createAdminClient();

    const checks: Record<string, boolean> = {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      appUrl: !!process.env.NEXT_PUBLIC_APP_URL,
      documentsBucket: !!process.env.DOCUMENTS_BUCKET,
      receiptsBucket: !!process.env.RECEIPTS_BUCKET,
      twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
      email: !!(process.env.EMAIL_PROVIDER_API_KEY && process.env.EMAIL_FROM),
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
