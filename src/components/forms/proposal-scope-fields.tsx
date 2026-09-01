"use client";

import { useId, useRef, useState } from "react";
import {
  PROPOSAL_SECTION_TYPE_LABELS,
  PROPOSAL_SECTION_TYPES,
  type ProposalSectionType,
} from "@/lib/proposal-sections";

export type ScopeSectionValue = {
  id: string;
  sectionType: ProposalSectionType;
  heading: string;
  content: string;
};

const EMPTY_SCOPE_SECTIONS: ScopeSectionValue[] = [];

function blankScopeSection(id: string): ScopeSectionValue {
  return {
    id,
    sectionType: "custom",
    heading: "",
    content: "",
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
            <label className="scope-content">
              Content
              <textarea
                name={`scope_content_${index}`}
                value={section.content}
                onChange={(event) => updateSection(section.id, { content: event.target.value })}
                placeholder="Describe the work included in this proposal."
                rows={5}
              />
            </label>
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
