import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const action = readFileSync("src/app/actions/invoice-delivery.ts", "utf8");
const component = readFileSync("src/components/billing/send-and-lock-invoice-form.tsx", "utf8");
const sourcePage = readFileSync("src/app/(app)/billing/[invoiceId]/page.tsx", "utf8");
const productionPage = readFileSync("app/(app)/billing/[invoiceId]/page.tsx", "utf8");
const detailData = readFileSync("src/lib/data/detail-data.ts", "utf8");

describe("invoice send and lock workflow", () => {
  it("replaces the separate issue control with one delivery action", () => {
    expect(sourcePage).not.toContain("IssueInvoiceButton");
    expect(productionPage).not.toContain("IssueInvoiceButton");
    expect(sourcePage).toContain("SendAndLockInvoiceForm");
    expect(productionPage).toContain("SendAndLockInvoiceForm");
    expect(component).toContain("Send and Lock Invoice");
    expect(component).toContain("Preview the customer PDF first");
  });

  it("offers every available delivery method and requires confirmation", () => {
    expect(component).toContain('<option value="email">Email</option>');
    expect(component).toContain('<option value="sms">Text message</option>');
    expect(component).toContain('<option value="both">Email and text</option>');
    expect(component).toContain("window.confirm");
  });

  it("supports drafts and the existing issued-but-unsent recovery state", () => {
    expect(action).toContain('invoice.status !== "draft" && invoice.status !== "issued"');
    expect(sourcePage).toContain('d.invoice.status === "draft" || d.invoice.status === "issued"');
    expect(action).toContain('if (invoice.status === "draft")');
    expect(action).toContain('admin.rpc("issue_invoice"');
  });

  it("locks and starts the due date only after provider delivery succeeds", () => {
    const deliveryCheck = action.indexOf("const delivered = results.some");
    const issueCall = action.indexOf('admin.rpc("issue_invoice"');
    const sentUpdate = action.indexOf('.update({status:"sent",sent_at:sentAt.toISOString(),due_date:dueDate})');

    expect(deliveryCheck).toBeGreaterThan(-1);
    expect(issueCall).toBeGreaterThan(deliveryCheck);
    expect(sentUpdate).toBeGreaterThan(issueCall);
    expect(action).toContain("the invoice remains editable and unlocked");
  });

  it("inherits delivery details from the project contact", () => {
    expect(detailData).toContain("primary_contact:contacts(id,first_name,last_name,email,mobile_phone)");
    expect(sourcePage).toContain("primaryContact?.email");
    expect(sourcePage).toContain("primaryContact?.mobile_phone");
  });
});
