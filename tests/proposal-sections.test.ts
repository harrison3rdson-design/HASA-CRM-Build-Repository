import { describe, expect, it } from "vitest";
import {
  PROPOSAL_SECTION_TYPES,
  parseProposalSectionType,
} from "../src/lib/proposal-sections";

describe("proposal scope sections", () => {
  it("accepts every supported section type", () => {
    for (const sectionType of PROPOSAL_SECTION_TYPES) {
      expect(parseProposalSectionType(sectionType)).toBe(sectionType);
    }
  });

  it("rejects unsupported section types", () => {
    expect(() => parseProposalSectionType("unknown")).toThrow(/invalid/i);
  });
});
