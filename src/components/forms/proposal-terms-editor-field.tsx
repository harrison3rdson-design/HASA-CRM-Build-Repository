"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  normalizeProposalContent,
  proposalContentToPlainText,
  type ProposalContentDocument,
} from "@/lib/proposal-content";

const ProposalContentEditor = dynamic(
  () => import("@/components/forms/proposal-content-editor").then((module) => module.ProposalContentEditor),
  { ssr: false },
);

export function ProposalTermsEditorField({
  textName,
  jsonName,
  initialText,
  initialContent,
  label,
  helpText,
}: {
  textName: string;
  jsonName: string;
  initialText: string;
  initialContent?: unknown;
  label: string;
  helpText: string;
}) {
  const initialDocument = useMemo(
    () => normalizeProposalContent(initialContent, initialText, "numbered-sections"),
    [initialContent, initialText],
  );
  const [content, setContent] = useState<ProposalContentDocument>(initialDocument);
  const [plainText, setPlainText] = useState(() => proposalContentToPlainText(initialDocument));

  return (
    <div className="full scope-content proposal-terms-editor-field">
      <label>{label}</label>
      <input type="hidden" name={textName} value={plainText} />
      <input type="hidden" name={jsonName} value={JSON.stringify(content)} />
      <ProposalContentEditor
        initialContent={initialDocument}
        fallbackText={initialText}
        fallbackMode="numbered-sections"
        ariaLabel={label}
        onChange={(nextContent, nextPlainText) => {
          setContent(nextContent);
          setPlainText(nextPlainText);
        }}
      />
      <span>{helpText}</span>
    </div>
  );
}
