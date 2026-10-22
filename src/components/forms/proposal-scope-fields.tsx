"use client";

import { useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  PROPOSAL_SECTION_TYPE_LABELS,
  PROPOSAL_SECTION_TYPES,
  type ProposalSectionType,
} from "@/lib/proposal-sections";
import {
  legacyTextToProposalDocument,
  type ProposalContentDocument,
} from "@/lib/proposal-content";

const ProposalContentEditor = dynamic(
  () => import("@/components/forms/proposal-content-editor")
    .then((module) => module.ProposalContentEditor),
  {
    ssr: false,
    loading: () => <div className="proposal-content-editor is-loading" aria-label="Loading content editor" />,
  },
);

export type ScopeSectionValue = {
  id: string;
  sectionType: ProposalSectionType;
  heading: string;
  content: string;
  contentJson?: ProposalContentDocument | null;
};

const EMPTY_SCOPE_SECTIONS: ScopeSectionValue[] = [];

function blankScopeSection(id: string): ScopeSectionValue {
  return {
    id,
    sectionType: "custom",
    heading: "",
    content: "",
    contentJson: legacyTextToProposalDocument(""),
  };
}

export function ProposalScopeFields({
  initialSections = EMPTY_SCOPE_SECTIONS,
}: {
  initialSections?: ScopeSectionValue[];
}) {
  const headingId = useId();
  const nextId = useRef(1);
  const [sections, setSections] = useState<ScopeSectionValue[]>(() =>
    initialSections.length ? initialSections : [blankScopeSection("scope-initial")],
  );

  const updateSection = (id: string, patch: Partial<ScopeSectionValue>) => {
    setSections((current) => current.map((section) =>
      section.id === id ? { ...section, ...patch } : section
    ));
  };

  return (
    <section className="full line-items-section" aria-labelledby={headingId}>
      <div className="line-items-heading">
        <div>
          <h2 id={headingId}>Scope</h2>
          <p>Add objectives, responsibilities, deliverables, exclusions, and other scope sections.</p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setSections((current) => [
            ...current,
            blankScopeSection(`scope-new-${nextId.current++}`),
          ])}
        >
          Add Scope Section
        </button>
      </div>
      <input type="hidden" name="scope_count" value={sections.length} />
      <div className="line-items-list">
        {sections.map((section, index) => (
          <div className="line-item scope-line" key={section.id}>
            <label>
              Section Type
              <select
                name={`scope_type_${index}`}
                value={section.sectionType}
                onChange={(event) => updateSection(section.id, {
                  sectionType: event.target.value as ProposalSectionType,
                })}
              >
                {PROPOSAL_SECTION_TYPES.map((type) => (
                  <option key={type} value={type}>{PROPOSAL_SECTION_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </label>
            <label>
              Heading
              <input
                name={`scope_heading_${index}`}
                value={section.heading}
                onChange={(event) => updateSection(section.id, { heading: event.target.value })}
                placeholder="Project Scope"
              />
            </label>
            <div className="scope-content">
              <span className="scope-content-label">Content</span>
              <input type="hidden" name={`scope_content_${index}`} value={section.content} />
              <input
                type="hidden"
                name={`scope_content_json_${index}`}
                value={JSON.stringify(section.contentJson ?? legacyTextToProposalDocument(section.content))}
              />
              <ProposalContentEditor
                initialContent={section.contentJson}
                fallbackText={section.content}
                onChange={(contentJson, content) => updateSection(section.id, { contentJson, content })}
              />
              <span className="scope-content-help">
                Use headings, emphasis, and lists here. The customer preview and accepted PDF will use this same formatting.
              </span>
            </div>
            <button
              className="text-button remove-line"
              type="button"
              onClick={() => setSections((current) =>
                current.filter((candidate) => candidate.id !== section.id)
              )}
              disabled={sections.length === 1}
              aria-label={`Remove scope section ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
