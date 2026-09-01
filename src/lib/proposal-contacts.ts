export type ProposalContactOption = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  mobile_phone: string | null;
  is_primary: boolean;
};

export function selectDefaultProposalContact<T extends Pick<ProposalContactOption, "is_primary">>(
  contacts: T[],
): T | null {
  return contacts.find((contact) => contact.is_primary) ?? contacts[0] ?? null;
}

export function normalizeRelatedContact<T>(contact: T | T[] | null | undefined): T | null {
  return Array.isArray(contact) ? contact[0] ?? null : contact ?? null;
}

export function proposalContactLabel(contact: ProposalContactOption): string {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unnamed contact";
  const methods = [
    contact.email ? "email" : null,
    contact.mobile_phone ? "mobile" : null,
  ].filter(Boolean);

  return methods.length ? `${name} (${methods.join(" + ")})` : name;
}
