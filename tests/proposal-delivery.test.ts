import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasAppUrl, resolveAppUrl } from "../src/lib/app-url";
import { isTwilioConfigured } from "../src/lib/messaging/twilio";
import { formatTransactionalSms } from "../src/lib/messaging/sms-body";
import {
  CUSTOMER_FACING_EMAIL_CC,
} from "../src/lib/delivery/customer-email-recipients";
import { normalizeEmailCcRecipients } from "../src/lib/messaging/email";

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

  it("identifies the brand and includes opt-out instructions in every SMS", () => {
    expect(formatTransactionalSms(
      "Please review proposal 20260153 for Sample Project.",
      "https://hasa-concepts-management.vercel.app/public/proposals/token",
    )).toBe(
      "HASA Concepts: Please review proposal 20260153 for Sample Project.\n" +
      "https://hasa-concepts-management.vercel.app/public/proposals/token\n" +
      "Reply STOP to opt out.",
    );
  });

  it("normalizes accidental surrounding whitespace without changing the secure link", () => {
    expect(formatTransactionalSms(" Invoice 20260153 is available for review. ", " https://example.com/document "))
      .toBe(
        "HASA Concepts: Invoice 20260153 is available for review.\n" +
        "https://example.com/document\n" +
        "Reply STOP to opt out.",
      );
  });

  it("returns expected send failures to the client instead of throwing an error page", () => {
    const action = readFileSync(resolve("src/app/actions/send-documents.ts"), "utf8");
    const button = readFileSync(resolve("src/components/proposals/send-proposal-button.tsx"), "utf8");

    expect(action).toContain("return { ok: false, error: providerError }");
    expect(action).toContain('message: "Proposal delivery failed"');
    expect(button).toContain("if (!result.ok)");
    expect(button).toContain("setError(result.error)");
  });

  it("carbon copies Andy on every customer-facing email without duplicate recipients", () => {
    const sharedDelivery = readFileSync(resolve("src/lib/delivery/send-document.ts"), "utf8");
    const acceptedProposal = readFileSync(
      resolve("src/lib/delivery/accepted-proposal-package.ts"),
      "utf8",
    );

    expect(CUSTOMER_FACING_EMAIL_CC).toBe("andy.harrison@hasaconcepts.com");
    expect(sharedDelivery).toContain("cc: CUSTOMER_FACING_EMAIL_CC");
    expect(acceptedProposal).toContain(
      'cc: recipient.kind === "customer" ? CUSTOMER_FACING_EMAIL_CC : undefined',
    );
    expect(normalizeEmailCcRecipients("client@example.com", [
      CUSTOMER_FACING_EMAIL_CC,
      "Andy.Harrison@hasaconcepts.com",
    ])).toEqual([CUSTOMER_FACING_EMAIL_CC]);
    expect(normalizeEmailCcRecipients(CUSTOMER_FACING_EMAIL_CC, CUSTOMER_FACING_EMAIL_CC))
      .toEqual([]);
  });
});
