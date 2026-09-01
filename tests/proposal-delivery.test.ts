import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasAppUrl, resolveAppUrl } from "../src/lib/app-url";
import { isTwilioConfigured } from "../src/lib/messaging/twilio";

describe("proposal delivery configuration", () => {
  it("uses Vercel's stable production domain when no custom app URL is set", () => {
    expect(resolveAppUrl({ VERCEL_PROJECT_PRODUCTION_URL: "hasa.example.com" }))
      .toBe("https://hasa.example.com");
  });

  it("prefers an explicitly configured server-side app URL", () => {
    expect(resolveAppUrl({
      APP_URL: "https://management.example.com/",
      VERCEL_PROJECT_PRODUCTION_URL: "generated.vercel.app",
    })).toBe("https://management.example.com");
  });

  it("reports missing URL and Twilio configuration", () => {
    expect(hasAppUrl({})).toBe(false);
    expect(isTwilioConfigured({})).toBe(false);
    expect(isTwilioConfigured({
      TWILIO_ACCOUNT_SID: "sid",
      TWILIO_AUTH_TOKEN: "token",
      TWILIO_FROM_NUMBER: "+15550100",
    })).toBe(true);
  });

  it("returns expected send failures to the client instead of throwing an error page", () => {
    const action = readFileSync(resolve("src/app/actions/send-documents.ts"), "utf8");
    const button = readFileSync(resolve("src/components/proposals/send-proposal-button.tsx"), "utf8");

    expect(action).toContain("return { ok: false, error: providerError }");
    expect(action).toContain('message: "Proposal delivery failed"');
    expect(button).toContain("if (!result.ok)");
    expect(button).toContain("setError(result.error)");
  });
});
