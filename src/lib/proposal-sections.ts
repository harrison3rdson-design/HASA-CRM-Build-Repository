export const PROPOSAL_SECTION_TYPES = [
  "objective",
  "consultant_responsibility",
  "client_responsibility",
  "deliverable",
  "exclusion",
  "schedule",
  "term",
  "custom",
] as const;

export type ProposalSectionType = (typeof PROPOSAL_SECTION_TYPES)[number];

export const PROPOSAL_SECTION_TYPE_LABELS: Record<ProposalSectionType, string> = {
  objective: "Objective",
  consultant_responsibility: "Consultant Responsibility",
  client_responsibility: "Client Responsibility",
  deliverable: "Deliverable",
  exclusion: "Exclusion",
  schedule: "Schedule",
  term: "Term",
  custom: "Custom",
};

export function parseProposalSectionType(value: unknown): ProposalSectionType {
  if (typeof value === "string" && PROPOSAL_SECTION_TYPES.includes(value as ProposalSectionType)) {
    return value as ProposalSectionType;
  }
  throw new Error("Proposal section type is invalid.");
}
