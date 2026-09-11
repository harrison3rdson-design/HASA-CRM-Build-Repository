import { roundMoney } from "./proposal-items";

export const PROPOSAL_ALTERNATE_TYPES = ["independent", "dependent", "bundle"] as const;

export type ProposalAlternateType = (typeof PROPOSAL_ALTERNATE_TYPES)[number];

export type ProposalAlternate = {
  id?: string;
  alternate_key: string;
  title: string;
  description?: string | null;
  alternate_type: ProposalAlternateType;
  amount: number | string;
  required_alternate_key?: string | null;
  bundle_component_keys?: string[] | null;
  sort_order?: number;
};

export type AlternateSelection = {
  selected: ProposalAlternate[];
  declined: ProposalAlternate[];
  selectedKeys: string[];
  alternateTotal: number;
  acceptedTotal: number;
};

export function parseProposalAlternateType(
  value: FormDataEntryValue | null,
): ProposalAlternateType {
  const type = String(value ?? "independent");
  if (!PROPOSAL_ALTERNATE_TYPES.includes(type as ProposalAlternateType)) {
    throw new Error("Alternate type is invalid.");
  }
  return type as ProposalAlternateType;
}

export function validateAlternateConfiguration<T extends ProposalAlternate>(alternates: T[]): T[] {
  const keys = new Set<string>();

  for (const alternate of alternates) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(alternate.alternate_key)) {
      throw new Error(`Alternate "${alternate.title || "Untitled"}" has an invalid internal key.`);
    }
    if (keys.has(alternate.alternate_key)) {
      throw new Error("Each alternate must have a unique internal key.");
    }
    keys.add(alternate.alternate_key);
    if (!alternate.title.trim()) throw new Error("Each alternate requires a title.");
    const amount = Number(alternate.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Alternate "${alternate.title}" requires a valid non-negative price.`);
    }
  }

  const byKey = new Map(alternates.map((alternate) => [alternate.alternate_key, alternate]));
  for (const alternate of alternates) {
    const requiredKey = alternate.required_alternate_key ?? null;
    const componentKeys = alternate.bundle_component_keys ?? [];

    if (alternate.alternate_type === "independent") {
      if (requiredKey || componentKeys.length) {
        throw new Error(`Independent alternate "${alternate.title}" cannot have dependency or bundle rules.`);
      }
      continue;
    }

    if (alternate.alternate_type === "dependent") {
      const required = requiredKey ? byKey.get(requiredKey) : null;
      if (!required || required.alternate_key === alternate.alternate_key) {
        throw new Error(`Dependent alternate "${alternate.title}" must require another alternate.`);
      }
      if (required.alternate_type !== "independent") {
        throw new Error(`Dependent alternate "${alternate.title}" must require an independent alternate.`);
      }
      if (componentKeys.length) {
        throw new Error(`Dependent alternate "${alternate.title}" cannot contain bundle components.`);
      }
      continue;
    }

    const uniqueComponents = new Set(componentKeys);
    if (requiredKey || !componentKeys.length || uniqueComponents.size !== componentKeys.length) {
      throw new Error(`Bundle alternate "${alternate.title}" must contain unique component alternates.`);
    }
    for (const key of componentKeys) {
      const component = byKey.get(key);
      if (!component || component.alternate_key === alternate.alternate_key || component.alternate_type === "bundle") {
        throw new Error(`Bundle alternate "${alternate.title}" contains an invalid component.`);
      }
    }
  }

  return alternates;
}

export function calculateAlternateSelection(
  alternates: ProposalAlternate[],
  requestedKeys: readonly string[],
  baseTotal: number | string,
): AlternateSelection {
  validateAlternateConfiguration(alternates);
  const requested = new Set(requestedKeys);
  if (requested.size !== requestedKeys.length) {
    throw new Error("An alternate was selected more than once.");
  }

  const byKey = new Map(alternates.map((alternate) => [alternate.alternate_key, alternate]));
  for (const key of requested) {
    if (!byKey.has(key)) throw new Error("The selected alternate is not part of this proposal version.");
  }

  for (const key of requested) {
    const alternate = byKey.get(key)!;
    if (
      alternate.alternate_type === "dependent"
      && !requested.has(alternate.required_alternate_key ?? "")
    ) {
      throw new Error(`"${alternate.title}" requires another alternate that has not been selected.`);
    }
    if (
      alternate.alternate_type === "bundle"
      && (alternate.bundle_component_keys ?? []).some((componentKey) => requested.has(componentKey))
    ) {
      throw new Error(`"${alternate.title}" cannot be selected with one of its component alternates.`);
    }
  }

  const selected = alternates.filter((alternate) => requested.has(alternate.alternate_key));
  const declined = alternates.filter((alternate) => !requested.has(alternate.alternate_key));
  const alternateTotal = roundMoney(
    selected.reduce((total, alternate) => total + Number(alternate.amount), 0),
  );

  return {
    selected,
    declined,
    selectedKeys: selected.map((alternate) => alternate.alternate_key),
    alternateTotal,
    acceptedTotal: roundMoney(Number(baseTotal) + alternateTotal),
  };
}
