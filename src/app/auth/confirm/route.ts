import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createAuthenticatedServerClient } from "@/lib/auth/server";

const permittedTypes: EmailOtpType[] = ["invite", "magiclink"];

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type && permittedTypes.includes(type)) {
    const supabase = await createAuthenticatedServerClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL("/accept-invite", request.url));
  }
  const failure = new URL("/login", request.url);
  failure.searchParams.set("error", "This account link is invalid or expired. Ask an administrator to send a new link.");
  return NextResponse.redirect(failure);
}
