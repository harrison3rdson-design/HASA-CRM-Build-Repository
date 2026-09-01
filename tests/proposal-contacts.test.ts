import { describe, expect, it } from "vitest";
import {
  normalizeRelatedContact,
  proposalContactLabel,
  selectDefaultProposalContact,
} from "../src/lib/proposal-contacts";

describe("proposal contacts", () => {
  it("prefers the Client contact marked primary", () => {
    const contacts = [
      { id: "first", is_primary: false },
      { id: "primary", is_primary: true },
    ];

    expect(selectDefaultProposalContact(contacts)?.id).toBe("primary");
  });

  it("falls back to the first contact", () => {
    expect(selectDefaultProposalContact([{ id: "first", is_primary: false }])?.id).toBe("first");
    expect(selectDefaultProposalContact([])).toBeNull();
  });

  it("normalizes one-to-one relationship results", () => {
    expect(normalizeRelatedContact({ id: "contact" })).toEqual({ id: "contact" });
    expect(normalizeRelatedContact([{ id: "contact" }])).toEqual({ id: "contact" });
    expect(normalizeRelatedContact([])).toBeNull();
  });

  it("shows available delivery methods without exposing the values", () => {
    expect(proposalContactLabel({
      id: "contact",
      first_name: "Primary",
      last_name: "Contact",
      email: "customer@example.com",
      mobile_phone: "+2975550100",
      is_primary: true,
    })).toBe("Primary Contact (email + mobile)");
  });
});
