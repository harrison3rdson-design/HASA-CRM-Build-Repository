import { afterEach, describe, expect, it } from "vitest";
import {
  buildAcceptanceNotification,
  DEFAULT_CUSTOMER_ACTION_NOTIFICATION_EMAIL,
} from "../src/lib/delivery/customer-action-notification";

const originalRecipient = process.env.CUSTOMER_ACTION_NOTIFICATION_EMAIL;

afterEach(() => {
  if (originalRecipient === undefined) {
    delete process.env.CUSTOMER_ACTION_NOTIFICATION_EMAIL;
  } else {
    process.env.CUSTOMER_ACTION_NOTIFICATION_EMAIL = originalRecipient;
  }
});

describe("customer action notifications", () => {
  it("emails Andy after a proposal acceptance by default", () => {
    delete process.env.CUSTOMER_ACTION_NOTIFICATION_EMAIL;
    const message = buildAcceptanceNotification({
      documentType: "proposal",
      relatedRecordId: "proposal-id",
      projectId: "project-id",
      reference: "Proposal 20260151",
      projectName: "Office Renovation",
      clientName: "Example Client",
      signerName: "Alex Client",
      signerEmail: "alex@example.com",
    });

    expect(message.to).toBe(DEFAULT_CUSTOMER_ACTION_NOTIFICATION_EMAIL);
    expect(message.subject).toBe("Customer accepted Proposal 20260151");
    expect(message.text).toContain("Alex Client");
    expect(message.text).toContain("/proposals/proposal-id");
    expect(message.idempotencyKey).toBe(
      "customer-accepted-proposal-proposal-id"
    );
  });

  it("escapes signer-provided values in the HTML email", () => {
    const message = buildAcceptanceNotification({
      documentType: "additional_service",
      relatedRecordId: "authorization-id",
      projectId: "project-id",
      reference: "Authorization AS-12",
      signerName: "<script>alert('x')</script>",
    });

    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
    expect(message.html).toContain("/projects/project-id");
  });
});
