"use client";

import { useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  PROPOSAL_ALTERNATE_TYPES,
  type ProposalAlternateType,
} from "@/lib/proposal-alternates";
import {
  legacyTextToProposalDocument,
  type ProposalContentDocument,
} from "@/lib/proposal-content";

const ProposalContentEditor = dynamic(
  () => import("@/components/forms/proposal-content-editor")
    .then((module) => module.ProposalContentEditor),
  {
    ssr: false,
    loading: () => <div className="proposal-content-editor is-loading" aria-label="Loading alternate description editor" />,
  },
);

export type AlternateLineValue = {
  id: string;
  alternateKey: string;
  title: string;
  description: string;
  descriptionJson?: ProposalContentDocument | null;
  alternateType: ProposalAlternateType;
  amount: string;
  requiredAlternateKey: string;
  bundleComponentKeys: string[];
};

const EMPTY_ALTERNATES: AlternateLineValue[] = [];

const typeLabels: Record<ProposalAlternateType, string> = {
  independent: "Independent",
  dependent: "Dependent",
  bundle: "Bundle",
};

function blankAlternate(id: string, alternateKey: string): AlternateLineValue {
  return {
    id,
    alternateKey,
    title: "",
    description: "",
    descriptionJson: legacyTextToProposalDocument(""),
    alternateType: "independent",
    amount: "",
    requiredAlternateKey: "",
    bundleComponentKeys: [],
  };
}

export function ProposalAlternatesFields({
  initialAlternates = EMPTY_ALTERNATES,
}: {
  initialAlternates?: AlternateLineValue[];
}) {
  const headingId = useId();
  const nextId = useRef(initialAlternates.length + 1);
  const [alternates, setAlternates] = useState<AlternateLineValue[]>(initialAlternates);

  const updateAlternate = (id: string, patch: Partial<AlternateLineValue>) => {
    setAlternates((current) => current.map((alternate) => (
      alternate.id === id ? { ...alternate, ...patch } : alternate
    )));
  };

  const removeAlternate = (removed: AlternateLineValue) => {
    setAlternates((current) => current
      .filter((alternate) => alternate.id !== removed.id)
      .map((alternate) => ({
        ...alternate,
        requiredAlternateKey: alternate.requiredAlternateKey === removed.alternateKey
          ? ""
          : alternate.requiredAlternateKey,
        bundleComponentKeys: alternate.bundleComponentKeys.filter(
          (key) => key !== removed.alternateKey,
        ),
      })));
  };

  return (
    <section className="full line-items-section" aria-labelledby={headingId}>
      <div className="line-items-heading">
        <div>
          <h2 id={headingId}>Customer-Selectable Alternates</h2>
          <p>
            Add fixed-price options the customer can elect during approval. Dependent options require
            an independent option; bundles replace the components they include.
          </p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            const sequence = nextId.current++;
            setAlternates((current) => [
              ...current,
              blankAlternate(`alternate-new-${sequence}`, `alternate-${sequence}`),
            ]);
          }}
        >
          Add Alternate
        </button>
      </div>
      <input type="hidden" name="alternate_count" value={alternates.length} />
      {alternates.length ? (
        <div className="line-items-list">
          {alternates.map((alternate, index) => {
            const lineStarted = Boolean(
              alternate.title.trim()
              || alternate.description.trim()
              || alternate.amount
              || alternate.alternateType !== "independent",
            );
            const otherAlternates = alternates.filter((candidate) => candidate.id !== alternate.id);
            const independentAlternates = otherAlternates.filter(
              (candidate) => candidate.alternateType === "independent",
            );
            const bundleCandidates = otherAlternates.filter(
              (candidate) => candidate.alternateType !== "bundle",
            );

            return (
              <div className="line-item alternate-line" key={alternate.id}>
                <input
                  type="hidden"
                  name={`alternate_key_${index}`}
                  value={alternate.alternateKey}
                />
                <label>
                  Alternate Title
                  <input
                    name={`alternate_title_${index}`}
                    value={alternate.title}
                    required={lineStarted}
                    onChange={(event) => updateAlternate(alternate.id, { title: event.target.value })}
                    placeholder="Missing residential drawing development"
                  />
                </label>
                <label>
                  Rule
                  <select
                    name={`alternate_type_${index}`}
                    value={alternate.alternateType}
                    onChange={(event) => updateAlternate(alternate.id, {
                      alternateType: event.target.value as ProposalAlternateType,
                      requiredAlternateKey: "",
                      bundleComponentKeys: [],
                    })}
                  >
                    {PROPOSAL_ALTERNATE_TYPES.map((type) => (
                      <option key={type} value={type}>{typeLabels[type]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Add to Contract
                  <input
                    name={`alternate_amount_${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={alternate.amount}
                    required={lineStarted}
                    onChange={(event) => updateAlternate(alternate.id, { amount: event.target.value })}
                    placeholder="$0.00"
                  />
                </label>
                <div className="alternate-description scope-content">
                  <span className="scope-content-label">Description</span>
                  <input
                    type="hidden"
                    name={`alternate_description_${index}`}
                    value={alternate.description}
                  />
                  <input
                    type="hidden"
                    name={`alternate_description_json_${index}`}
                    value={JSON.stringify(
                      alternate.descriptionJson
                        ?? legacyTextToProposalDocument(alternate.description),
                    )}
                  />
                  <ProposalContentEditor
                    initialContent={alternate.descriptionJson}
                    fallbackText={alternate.description}
                    ariaLabel={`Alternate ${index + 1} description`}
                    onChange={(descriptionJson, description) => updateAlternate(
                      alternate.id,
                      { descriptionJson, description },
                    )}
                  />
                  <span className="scope-content-help">
                    Use headings, emphasis, and lists here. This formatting will appear in the customer preview and accepted PDF.
                  </span>
                </div>

                {alternate.alternateType === "dependent" ? (
                  <label className="alternate-rule-detail">
                    Requires
                    <select
                      name={`alternate_requires_key_${index}`}
                      value={alternate.requiredAlternateKey}
                      required
                      onChange={(event) => updateAlternate(alternate.id, {
                        requiredAlternateKey: event.target.value,
                      })}
                    >
                      <option value="">Select required alternate</option>
                      {independentAlternates.map((candidate, candidateIndex) => (
                        <option key={candidate.id} value={candidate.alternateKey}>
                          {candidate.title || `Independent alternate ${candidateIndex + 1}`}
                        </option>
                      ))}
                    </select>
                    <span>The customer must select this option first.</span>
                  </label>
                ) : null}

                {alternate.alternateType === "bundle" ? (
                  <fieldset className="alternate-components">
                    <legend>Bundle Components</legend>
                    <input
                      type="hidden"
                      name={`alternate_bundle_keys_${index}`}
                      value={alternate.bundleComponentKeys.join(",")}
                    />
                    {bundleCandidates.length ? bundleCandidates.map((candidate, candidateIndex) => (
                      <label className="check" key={candidate.id}>
                        <input
                          type="checkbox"
                          checked={alternate.bundleComponentKeys.includes(candidate.alternateKey)}
                          onChange={(event) => updateAlternate(alternate.id, {
                            bundleComponentKeys: event.target.checked
                              ? [...alternate.bundleComponentKeys, candidate.alternateKey]
                              : alternate.bundleComponentKeys.filter((key) => key !== candidate.alternateKey),
                          })}
                        />
                        {candidate.title || `Alternate ${candidateIndex + 1}`}
                      </label>
                    )) : <p>Add independent or dependent alternates before defining a bundle.</p>}
                  </fieldset>
                ) : null}

                <button
                  className="text-button remove-line"
                  type="button"
                  onClick={() => removeAlternate(alternate)}
                  aria-label={`Remove alternate ${index + 1}`}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="footnote">No alternates are included. The required base proposal will be the only acceptance choice.</p>
      )}
    </section>
  );
}
