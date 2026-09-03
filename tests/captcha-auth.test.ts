import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("Turnstile sign-in protection", () => {
  it("requires and forwards a CAPTCHA token during password sign-in", () => {
    const action = read("src/app/actions/auth.ts");
    expect(action).toContain('formData.get("captchaToken")');
    expect(action).toContain("options: { captchaToken }");
  });

  it("disables sign-in until Turnstile produces a token", () => {
    const form = read("src/components/forms/login-form.tsx");
    expect(form).toContain("@marsidev/react-turnstile");
    expect(form).toContain('name="captchaToken"');
    expect(form).toContain("disabled={!captchaConfigured || !captchaToken}");
  });

  it("permits the Turnstile origin in the content security policy", () => {
    const config = read("next.config.ts");
    expect(config).toContain("script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com");
    expect(config).toContain("frame-src https://challenges.cloudflare.com");
    expect(config).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com");
  });
});
